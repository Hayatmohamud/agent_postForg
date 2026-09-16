/**
 * `generatePost` (T05): the durable Inngest function that runs the T04
 * agent network end-to-end and persists per-stage progress, sub-progress,
 * and telemetry to Mongo incrementally so a poller (T11) sees intermediate
 * state, not just the final document.
 *
 * ---------------------------------------------------------------------
 * DESIGN DECISION: one durable step wrapping the whole network run, with
 * AgentKit's Inngest step-detection deliberately bypassed for inference
 * calls. Documented in full in tasks/reports.jsonl; summary below.
 * ---------------------------------------------------------------------
 *
 * `tasks/README.md`'s "known pitfalls" section flags a real, previously-hit
 * bug: AgentKit + OpenRouter's `step.ai.infer` can 400 through Inngest's
 * AI-Gateway offload. Reading `node_modules/@inngest/agent-kit` (v0.13.2)
 * and `node_modules/inngest`'s actual source confirms *why*, and that the
 * old "just wrap network.run() in step.run()" instinct does not fix it:
 *
 * - `AgenticModel.infer()` (agent-kit's per-call model invoker) calls an
 *   internal `getStepTools()` on every single inference, which reads
 *   Inngest's own AsyncLocalStorage-based execution context
 *   (`inngest/experimental`'s `getAsyncCtx()`). If that context is present,
 *   it *always* routes the call through `step.ai.infer` (Inngest's
 *   AI-Gateway proxy) instead of calling the model directly.
 * - Inngest's own `InngestExecution.start()` (`components/execution/
 *   engine.js`) wraps ALS around the *entire* function body via
 *   `als.run({ execution: { ctx: this.fnArg, ... } }, ...)` -- not just the
 *   inside of an explicit `step.run()` callback. So `getStepTools()` finds
 *   a truthy step context for *every* model call made anywhere in this
 *   handler, whether or not we add our own `step.run()` wrapper around
 *   `network.run()`. A naive `step.run(() => network.run(topic))` wrapper
 *   does not remove that ambient context -- it just adds an *extra*,
 *   unsupported layer of nested `step.*` calls on top of the
 *   already-triggered `step.ai.infer` calls (Inngest explicitly warns
 *   "Nesting step.* calls is not supported" -- see `ErrCode.NESTING_STEPS`
 *   in `inngest/components/execution/engine.js`), which plausibly explains
 *   the 400s a prior build hit.
 * - AgentKit provides no public option to opt a call out of step detection
 *   (no `disableGateway`, no `step` override threaded into
 *   `AgenticModel.infer()`). The only way to make `getStepTools()` return
 *   `undefined` -- and force `AgenticModel.infer()` down its *other*,
 *   already-implemented code path (a plain direct `fetch()` straight to
 *   OpenRouter, using the same URL/model/apiKey `lib/models.ts` already
 *   builds) -- is Node's own `AsyncLocalStorage.exit()`, escaping the
 *   ambient context for the duration of a callback (and everything it
 *   asynchronously spawns).
 *
 * `withoutInngestStepContext()` below does exactly that: it reaches into
 * Inngest's internal, well-known global symbol (`Symbol.for("inngest:als")`)
 * to grab the actual `AsyncLocalStorage` instance Inngest already
 * initialized, and calls its `.exit()` around `network.run()`. This is an
 * internal implementation detail (not a stable public API), so the helper
 * is defensive: if the symbol or `.exit` isn't present (e.g. a future
 * Inngest version changes this), it just calls the function with ambient
 * context intact and accepts the AI-Gateway risk rather than crashing.
 *
 * The consequence of this choice: individual model calls are NOT visible
 * as separate named steps in the Inngest dashboard (acceptance criterion 4
 * is not literally met under Inngest's own step view) -- but they *are*
 * durable as a single atomic unit (the whole `network.run()` is one
 * `step.run("run-network", ...)`), they no longer risk the AI-Gateway 400,
 * and per-agent/per-stage observability is still fully available -- just
 * via MongoDB (`stages`, `subProgress`, `telemetry`) rather than Inngest's
 * step list, which matches this project's own locked decision ("Live
 * progress: polling `GET /api/posts/[id]` ... no token streaming",
 * `tasks/README.md`) and PLAN.md's UI design (poll `/api/posts/[id]`).
 *
 * ---------------------------------------------------------------------
 * PER-STAGE PERSISTENCE HOOK: network.run(topic, { router })
 * ---------------------------------------------------------------------
 * T04's agents (already merged) mutate `network.state.data` directly in
 * their own `onFinish` lifecycle hooks and are out of this task's file
 * scope. Rather than editing those files, this function taps the *router*
 * override AgentKit already exposes as a public, documented per-call
 * extension point: `network.run(input, { router })` (see
 * `Network.RunArgs` in `agent-Prh3eG94.d.ts`) takes full precedence over
 * the network's own router and is called once before *every* agent turn
 * (and once more after the last one, when it returns `undefined` to stop
 * the loop), receiving `{ network, lastResult, callCount, stack }`.
 *
 * The wrapper below re-implements the exact same deterministic routing
 * T04 already built (`routeNext`, imported unchanged from
 * `agents/network.ts`) using `network.agents` (a public `Map<string,
 * Agent<T>>` the `Network` class exposes), so it makes identical routing
 * decisions -- but as a side effect, persists `stages`/`status`/
 * `subProgress`/`telemetry` incrementally each time it's invoked. No T04
 * file is modified.
 */

import { NonRetriableError } from "inngest";
import type { AgentResult } from "@inngest/agent-kit";
import { inngest } from "./client";
import { buildNetwork, routeNext, type PipelineAgents } from "@/agents/network";
import {
  getPostById,
  updateStage,
  appendSubProgress,
  recordTelemetry,
  recordError,
} from "@/lib/posts-repo";
import type { GenerationOptions, NetworkState, Stage } from "@/lib/state";

/** Event payload contract owned by this function (BRD 6). */
export type GeneratePostRequested = {
  postId: string;
  runId: string;
  topic: string;
  options?: GenerationOptions;
};

/** Maps an agent's `.name` to the pipeline `Stage` it corresponds to. */
const AGENT_TO_STAGE: Record<string, Stage> = {
  research: "research",
  verify: "verify",
  writer: "write",
  editor: "edit",
  illustrator: "illustrate",
  publisher: "publish",
};

/** `posts.status` to set while a given stage is active. */
const STAGE_TO_STATUS = {
  research: "researching",
  verify: "verifying",
  write: "writing",
  edit: "editing",
  illustrate: "illustrating",
  publish: "publishing",
} as const;

/**
 * Mirrors `routeNext`'s own "is this stage's output present yet" checks
 * (kept in sync with `agents/network.ts`'s `isEmpty`/if-ladder) so the
 * router wrapper can tell a stage's *final* completion (worth marking
 * `stages[stage].state = "done"`) apart from an in-progress retry attempt
 * of the same stage (T04's own `MAX_STAGE_ATTEMPTS` loop -- e.g. the
 * research agent re-running because its first pass didn't parse).
 */
function isStageComplete(stage: Stage, state: NetworkState): boolean {
  switch (stage) {
    case "research":
      return Array.isArray(state.research) && state.research.length > 0;
    case "verify":
      return Array.isArray(state.verifiedFindings) && state.verifiedFindings.length > 0;
    case "write":
      return Boolean(state.draft);
    case "edit":
      return Boolean(state.finalPost);
    case "illustrate":
      return Boolean(state.posterImageId);
    case "publish":
      return Boolean(state.published);
    default:
      return false;
  }
}

/** Best-effort total-token extraction from an AgentResult's raw JSON body. */
function extractTokens(result: AgentResult): number | undefined {
  if (!result.raw) return undefined;
  try {
    const raw = JSON.parse(result.raw) as {
      usage?: { total_tokens?: number; totalTokens?: number };
    };
    const tokens = raw.usage?.total_tokens ?? raw.usage?.totalTokens;
    return typeof tokens === "number" ? tokens : undefined;
  } catch {
    return undefined;
  }
}

/** Pulls `{query}` args out of any `web_search` tool calls in this result. */
function extractSearchQueries(result: AgentResult): string[] {
  const queries: string[] = [];
  for (const call of result.toolCalls) {
    if (call.tool.name === "web_search" && typeof call.tool.input?.query === "string") {
      queries.push(call.tool.input.query as string);
    }
  }
  return queries;
}

/**
 * Builds the sub-progress entry BRD 4.5 asks for on stage completion:
 * Research (queries + sources found), Verify (per-claim marks),
 * Writer/Editor (a bounded text preview), Illustrator ("poster-ready"),
 * Publisher ("saved").
 */
function buildSubProgress(stage: Stage, state: NetworkState, result: AgentResult) {
  const at = new Date();
  switch (stage) {
    case "research":
      return {
        stage,
        kind: "sources-found",
        data: { count: state.research?.length ?? 0, queries: extractSearchQueries(result) },
        at,
      };
    case "verify":
      return {
        stage,
        kind: "claims-checked",
        data: {
          marks: (state.verifiedFindings ?? []).map((f) => ({
            claim: f.claim,
            verified: f.verified,
          })),
        },
        at,
      };
    case "write":
      return {
        stage,
        kind: "draft-chunk",
        data: { preview: (state.draft ?? "").slice(0, 280) },
        at,
      };
    case "edit":
      return {
        stage,
        kind: "final-chunk",
        data: { title: state.title, preview: (state.finalPost ?? "").slice(0, 280) },
        at,
      };
    case "illustrate":
      return {
        stage,
        kind: "poster-ready",
        data: { posterImageId: state.posterImageId },
        at,
      };
    case "publish":
      return {
        stage,
        kind: "saved",
        data: { postId: state.postId },
        at,
      };
  }
}

/**
 * Escapes Inngest's ambient AsyncLocalStorage execution context (see this
 * file's top doc-comment) so AgentKit's `getStepTools()` returns
 * `undefined` for the duration of `fn`, forcing every model call inside it
 * down AgentKit's direct-fetch path instead of `step.ai.infer`'s
 * AI-Gateway proxy. Defensive: falls back to calling `fn()` with ambient
 * context intact if Inngest's internal ALS handle isn't reachable (e.g. a
 * future SDK version renames/removes the symbol), so this never throws on
 * its own.
 */
async function withoutInngestStepContext<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const alsSymbol = Symbol.for("inngest:als");
    const cache = (globalThis as Record<symbol, unknown>)[alsSymbol] as
      | { resolved?: { exit?: (cb: () => void) => void } }
      | undefined;
    const als = cache?.resolved;
    if (als && typeof als.exit === "function") {
      return await new Promise<T>((resolve, reject) => {
        als.exit!(() => {
          fn().then(resolve, reject);
        });
      });
    }
  } catch {
    // Fall through to running fn() with ambient context intact.
  }
  return fn();
}

/** Reads agent instances off the built network by name (a public Map). */
function pipelineAgentsFromNetwork(
  network: ReturnType<typeof buildNetwork>
): PipelineAgents {
  const get = (name: string) => {
    const agent = network.agents.get(name);
    if (!agent) {
      throw new Error(`generatePost: network is missing the "${name}" agent`);
    }
    return agent;
  };
  return {
    research: get("research"),
    verify: get("verify"),
    writer: get("writer"),
    editor: get("editor"),
    illustrator: get("illustrator"),
    publisher: get("publisher"),
  };
}

export const generatePost = inngest.createFunction(
  { id: "generate-post", retries: 2 },
  { event: "post/generate.requested" },
  async ({ event, step, attempt, maxAttempts }) => {
    const { postId, runId, topic, options } = event.data as GeneratePostRequested;
    const isFinalAttempt = attempt >= (maxAttempts ?? 3) - 1;

    // Doc ownership: POST /api/generate (T06) creates the doc + mints
    // runId; this function only updates it (BRD 2). Fail cleanly (and
    // non-retriably -- a missing postId will never appear on retry) if
    // it's somehow missing.
    const post = await step.run("load-post", async () => {
      const doc = await getPostById(postId);
      if (!doc) {
        throw new NonRetriableError(
          `generatePost: no post document found for postId ${postId} (runId ${runId})`
        );
      }
      return doc;
    });

    // Idempotency (BRD 4.7): a redelivered/retried event for a run that
    // already reached a terminal state is a no-op, not a re-run.
    if (post.status === "done" || post.status === "failed") {
      return { postId, runId, status: post.status, skipped: true };
    }

    // Tracks the stage this attempt was working on when/if it fails, so
    // the catch block below can attribute the failure correctly even
    // though the network run itself is one opaque durable step.
    let currentStage: Stage = "research";

    try {
      const network = buildNetwork({ runId, options });
      // Seed state.data with { runId, options, postId } per BRD 2 --
      // buildNetwork() already seeds runId/options; postId isn't part of
      // its constructor contract (T04 owns that type), so it's set here.
      network.state.data.postId = postId;
      const pipelineAgents = pipelineAgentsFromNetwork(network);

      await step.run("run-network", async () => {
        await withoutInngestStepContext(() =>
          network.run(topic, {
            // Re-implements T04's own deterministic router (`routeNext`,
            // unchanged) so this wrapper's persistence side effects never
            // change *which* agent runs next -- only observes it.
            router: async (args) => {
              const state = args.network.state.data;

              if (args.lastResult) {
                const finishedStage = AGENT_TO_STAGE[args.lastResult.agentName];
                if (finishedStage) {
                  const tokens = extractTokens(args.lastResult);
                  if (tokens) {
                    await recordTelemetry(postId, {
                      agent: args.lastResult.agentName,
                      tokens,
                    });
                  }

                  if (isStageComplete(finishedStage, state)) {
                    await updateStage(postId, finishedStage, {
                      state: "done",
                      endedAt: new Date(),
                    });
                    await appendSubProgress(
                      postId,
                      buildSubProgress(finishedStage, state, args.lastResult)
                    );
                  } else {
                    // Still mid-attempt on the same stage (T04's own
                    // MAX_STAGE_ATTEMPTS retry loop) -- observable, but
                    // not a stage-state transition yet.
                    await appendSubProgress(postId, {
                      stage: finishedStage,
                      kind: "attempt",
                      data: { agent: args.lastResult.agentName },
                      at: new Date(),
                    });
                  }
                }
              }

              const next = routeNext(state, pipelineAgents);
              if (next) {
                const nextStage = AGENT_TO_STAGE[next.name];
                if (nextStage) {
                  currentStage = nextStage;
                  await updateStage(
                    postId,
                    nextStage,
                    { state: "active", startedAt: new Date() },
                    STAGE_TO_STATUS[nextStage]
                  );
                }
              }
              return next;
            },
          })
        );
      });

      // network.run() never throws on a "stuck" pipeline (AgentKit's
      // maxIter cap just ends the loop silently -- see this file's top
      // comment / the T05 report for the source read confirming this).
      // The only reliable terminal-success signal is `published === true`
      // having actually been reached in Mongo, which the publisher's
      // `save_post` tool (T03) sets via `upsertFinalPost` (status:"done").
      const finished = await getPostById(postId);
      if (finished?.status !== "done") {
        const message =
          "Pipeline did not reach the publish stage (likely hit the router's " +
          "max-iteration safety cap without a stage producing valid output).";
        await updateStage(postId, currentStage, {
          state: "failed",
          endedAt: new Date(),
          detail: message,
        });
        await recordError(postId, currentStage, message);
        return { postId, runId, status: "failed" as const, reason: message };
      }

      return { postId, runId, status: "done" as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Always mark the in-flight stage failed and note the attempt, so
      // partial state is visible immediately regardless of whether this
      // is a transient error Inngest will retry.
      await updateStage(postId, currentStage, {
        state: "failed",
        endedAt: new Date(),
        detail: message,
      }).catch(() => {
        // Best-effort: don't let a bookkeeping write mask the real error.
      });

      if (isFinalAttempt) {
        // Deliberate choice (documented in the T05 report): only flip
        // `posts.status` to "failed" once Inngest has genuinely exhausted
        // its retries. Writing status:"failed" on every transient attempt
        // would flap the UI between "failed" and "researching"/etc. for
        // errors that go on to succeed on retry; recordError() sets both
        // status and the structured error field together, so it should
        // only fire once retries are truly exhausted. We still re-throw
        // in every case (see below) so Inngest's own dashboard accurately
        // shows this run's real outcome, not a false "Completed".
        await recordError(postId, currentStage, message).catch(() => {});
      } else {
        await appendSubProgress(postId, {
          stage: currentStage,
          kind: "retrying",
          data: { attempt, message },
          at: new Date(),
        }).catch(() => {});
      }

      // Re-throw unconditionally: this is the "decide deliberately"
      // BRD callout. We choose to re-throw (not catch-and-swallow) so
      // Inngest's own run status/backoff/retry-count semantics apply
      // normally and its dashboard reflects reality; `posts.status`
      // is kept in sync independently above rather than by relying on
      // Inngest's run status (which a caught error would otherwise leave
      // as a misleading "Completed").
      throw err;
    }
  }
);
