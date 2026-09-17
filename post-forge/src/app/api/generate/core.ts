/**
 * Composable "create a generation run" core (T06 BRD 4.1), deliberately
 * split out of `route.ts`: Next.js's App Router route-file export
 * validation only permits exporting HTTP-method handlers (`GET`, `POST`,
 * etc.) from a `route.ts` file — an extra named export like
 * `createGenerationRun` alongside `POST` is rejected at build time. Putting
 * the reusable logic here instead lets `route.ts` stay a thin adapter, and
 * lets future callers (T19's rate-limit/dedupe wrapper, T14's cron) import
 * and call this directly without going through HTTP.
 */

import { z } from "zod";
import { inngest } from "@/inngest/client";
import { countInFlightPosts, createPost, findPostsSince } from "@/lib/posts-repo";
import { dedupeWindowHours, maxInflightRuns } from "@/lib/env";
import { checkConcurrencyCap, checkDedupe } from "@/lib/generation-guards";
import type { GenerateBlockedResponse } from "@/lib/dto";
import type { GenerationOptions } from "@/lib/state";

/** `GenerationOptions` validated exactly as `state.ts` defines it. */
export const generationOptionsSchema = z.object({
  model: z.string().min(1).optional(),
  imageModel: z.string().min(1).optional(),
  tone: z.string().min(1).optional(),
  length: z.enum(["short", "medium", "long"]).optional(),
}) satisfies z.ZodType<GenerationOptions>;

/** Request body schema for `POST /api/generate`. */
export const generateRequestSchema = z.object({
  topic: z.string().trim().min(1, "topic is required"),
  options: generationOptionsSchema.optional(),
});

export type GenerateRequestInput = z.infer<typeof generateRequestSchema>;

export type CreateGenerationRunResult = {
  id: string;
  runId: string;
};

/**
 * Thrown by `createGenerationRun` when T19's rate-limit/dedupe guard blocks
 * the request. `route.ts` catches this specifically and returns `response`
 * as a 429, keeping `core.ts` free of any HTTP-status concerns (per the
 * module's whole reason for existing — see the file-level doc comment).
 */
export class GenerationBlockedError extends Error {
  readonly response: GenerateBlockedResponse;

  constructor(response: GenerateBlockedResponse) {
    super(response.error.message);
    this.name = "GenerationBlockedError";
    this.response = response;
  }
}

/**
 * T19's guard layer, run before doc creation: a concurrency/quota cap
 * (count of non-terminal posts vs. `MAX_INFLIGHT_RUNS`) followed by a
 * duplicate-topic dedupe check (normalized-topic match against posts from
 * the last `DEDUPE_WINDOW_HOURS`). Throws `GenerationBlockedError` if either
 * check blocks the request; otherwise returns normally.
 *
 * Concurrency note (intentionally NOT solved here): this is a
 * check-then-create, not an atomic reservation — two requests racing each
 * other can both pass these checks and both call `createPost` before either
 * doc exists to be counted/matched by the other. Running the checks as the
 * very last thing before `createPost` (rather than earlier in the request,
 * e.g. in `route.ts`) narrows that window as much as reasonably possible
 * without a distributed lock, but does not eliminate it. That's judged
 * acceptable for this project's single-tenant, low-concurrency scale (see
 * BRD scope); it is not a claim of atomicity.
 */
async function runGenerationGuards(topic: string): Promise<void> {
  const inFlightCount = await countInFlightPosts();
  const concurrencyDecision = checkConcurrencyCap(inFlightCount, maxInflightRuns());
  if (concurrencyDecision.blocked) {
    throw new GenerationBlockedError({
      error: { message: concurrencyDecision.message, code: concurrencyDecision.code },
    });
  }

  const windowHours = dedupeWindowHours();
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);
  const recentPosts = await findPostsSince(since);
  const dedupeDecision = checkDedupe(topic, recentPosts, windowHours);
  if (dedupeDecision.blocked) {
    throw new GenerationBlockedError({
      error: { message: dedupeDecision.message, code: dedupeDecision.code },
      existingPostId: dedupeDecision.existingPostId,
    });
  }
}

/**
 * Creates the post doc (owning both doc creation and `runId` minting per
 * the BRD) and emits the `post/generate.requested` event the Inngest
 * function (T05) consumes. Returns the navigable post id + runId.
 *
 * Runs T19's rate-limit/dedupe guard immediately before doc creation; see
 * `runGenerationGuards`'s doc comment for what it does and does not
 * guarantee under concurrent requests.
 */
export async function createGenerationRun(
  input: GenerateRequestInput
): Promise<CreateGenerationRunResult> {
  const runId = crypto.randomUUID();
  const options: GenerationOptions = input.options ?? {};

  await runGenerationGuards(input.topic);

  const post = await createPost(input.topic, runId, options);
  const id = post._id.toString();

  await inngest.send({
    name: "post/generate.requested",
    data: { postId: id, runId, topic: input.topic, options },
  });

  return { id, runId };
}
