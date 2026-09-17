/**
 * Happy-path pipeline integration test (T18 BRD §4.5 / §9).
 *
 * BOUNDARY TESTED vs. NOT TESTED (documented per the T18 brief, since a
 * real `inngest.createFunction`-wrapped function is impractical to unit
 * test in isolation -- it needs Inngest's own dev-server/step-execution
 * runtime, not just a mocked import):
 *
 *  - TESTED for real: `routeNext` (the deterministic router, unchanged
 *    import from `agents/network.ts`), the repository functions
 *    (`createPost`/`updateStage`/`appendSubProgress`/`getPostById`, backed
 *    by the in-memory `FakeDb` -- see `posts-repo.test.ts`'s header for the
 *    Mongo-strategy note), and the actual tool handlers
 *    (`web_search`/`generate_poster`/`save_post`) with only their external
 *    provider calls mocked (Serper's `fetch`, `@/lib/image`'s
 *    `generatePoster`, GridFS's upload stream).
 *  - NOT TESTED here: the six AgentKit `Agent` instances' own model-driven
 *    tool-call decisions (T04's research/verify/writer/editor/illustrator/
 *    publisher agents -- they decide *when* to call these tools via a real
 *    LLM turn, which needs OPENROUTER_API_KEY) and `src/inngest/
 *    functions.ts`'s Inngest `step.run`/durable-execution wrapper itself
 *    (needs a running Inngest dev server). This test instead drives the
 *    same state machine `functions.ts`'s router wrapper drives --
 *    `routeNext` + per-stage `updateStage`/`appendSubProgress` persistence
 *    -- with hand-supplied stage outputs standing in for what each agent
 *    would have produced, so the router-to-repository wiring itself (the
 *    part `functions.ts` "owns" beyond T04's agents) is exercised
 *    end-to-end and asserted to land on a `done` doc with every field
 *    populated.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "@inngest/agent-kit";
import { FakeDb } from "@/lib/test-helpers/fake-mongo";
import { ObjectId } from "mongodb";

let fakeDb = new FakeDb();

class FakeUploadStream {
  id = new ObjectId();
  private handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  metadata: unknown;
  constructor(_filename: string, options: { metadata?: unknown }) {
    this.metadata = options.metadata;
  }
  once(event: string, cb: (...args: unknown[]) => void) {
    (this.handlers[event] ??= []).push(cb);
    return this;
  }
  end() {
    queueMicrotask(() => {
      for (const cb of this.handlers.finish ?? []) cb();
    });
  }
}

vi.mock("@/lib/mongo", () => ({
  getDb: async () => fakeDb,
  getBucket: async () => ({
    openUploadStream: (filename: string, options: { metadata?: unknown }) =>
      new FakeUploadStream(filename, options),
  }),
}));

vi.mock("@/lib/image", () => ({
  generatePoster: vi.fn(async () => ({ bytes: Buffer.from("poster-bytes"), mime: "image/png" })),
}));

beforeEach(() => {
  fakeDb = new FakeDb();
});

import { routeNext, type PipelineAgents } from "@/agents/network";
import { webSearchTool } from "@/agents/tools/web_search";
import { generatePosterTool } from "@/agents/tools/generate_poster";
import { savePostTool } from "@/agents/tools/save_post";
import { createPost, getPostById, updateStage, appendSubProgress } from "@/lib/posts-repo";
import type { NetworkState, Stage } from "@/lib/state";

function stubAgent(name: string): Agent<NetworkState> {
  return { name } as unknown as Agent<NetworkState>;
}

const agents: PipelineAgents = {
  research: stubAgent("research"),
  verify: stubAgent("verify"),
  writer: stubAgent("writer"),
  editor: stubAgent("editor"),
  illustrator: stubAgent("illustrator"),
  publisher: stubAgent("publisher"),
};

const STAGE_TO_STATUS: Record<Stage, string> = {
  research: "researching",
  verify: "verifying",
  write: "writing",
  edit: "editing",
  illustrate: "illustrating",
  publish: "publishing",
};

describe("generate-post pipeline happy path (router + repo + tools, agents/Inngest boundary mocked)", () => {
  it("drives a fresh post through every stage to a done doc with populated fields", async () => {
    const runId = "run-integration-1";
    const doc = await createPost("Integration Topic", runId, {});
    const postId = doc._id.toString();

    const state: NetworkState = { runId, options: {}, postId };

    // --- Research ---------------------------------------------------
    expect(routeNext(state, agents)).toBe(agents.research);
    await updateStage(postId, "research", { state: "active", startedAt: new Date() }, STAGE_TO_STATUS.research);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            organic: [{ title: "Source A", link: "https://a.example.com", snippet: "..." }],
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    vi.stubEnv("SERPER_API_KEY", "test-key");
    const searchResults = (await (
      webSearchTool.handler as (args: unknown, ctx: unknown) => Promise<{ title: string; url: string }[]>
    )({ query: "integration topic" }, {})) as { title: string; url: string }[];
    state.research = searchResults.map((r) => ({
      claim: `${r.title} claim`,
      source: { title: r.title, url: r.url },
      verified: false,
    }));

    await updateStage(postId, "research", { state: "done", endedAt: new Date() });
    await appendSubProgress(postId, { stage: "research", kind: "sources-found", data: {}, at: new Date() });
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();

    // --- Verify -------------------------------------------------------
    expect(routeNext(state, agents)).toBe(agents.verify);
    await updateStage(postId, "verify", { state: "active", startedAt: new Date() }, STAGE_TO_STATUS.verify);
    state.verifiedFindings = state.research.map((f) => ({ ...f, verified: true }));
    await updateStage(postId, "verify", { state: "done", endedAt: new Date() });

    // --- Write ----------------------------------------------------------
    expect(routeNext(state, agents)).toBe(agents.writer);
    await updateStage(postId, "write", { state: "active", startedAt: new Date() }, STAGE_TO_STATUS.write);
    state.draft = "A full draft body about the integration topic.";
    await updateStage(postId, "write", { state: "done", endedAt: new Date() });

    // --- Edit -------------------------------------------------------------
    expect(routeNext(state, agents)).toBe(agents.editor);
    await updateStage(postId, "edit", { state: "active", startedAt: new Date() }, STAGE_TO_STATUS.edit);
    state.finalPost = "The polished final article body.";
    state.title = "Integration Topic: A Deep Dive";
    await updateStage(postId, "edit", { state: "done", endedAt: new Date() });

    // --- Illustrate (real tool, mocked OpenRouter image call + GridFS) ---
    expect(routeNext(state, agents)).toBe(agents.illustrator);
    await updateStage(postId, "illustrate", { state: "active", startedAt: new Date() }, STAGE_TO_STATUS.illustrate);
    await (generatePosterTool.handler as (args: unknown, ctx: unknown) => Promise<unknown>)(
      { prompt: "poster prompt" },
      { network: { state: { data: state } } }
    );
    expect(state.posterImageId).toBeTruthy();
    await updateStage(postId, "illustrate", { state: "done", endedAt: new Date() });

    // --- Publish (real tool, real posts-repo, fake Mongo) -----------------
    expect(routeNext(state, agents)).toBe(agents.publisher);
    await updateStage(postId, "publish", { state: "active", startedAt: new Date() }, STAGE_TO_STATUS.publish);
    await (savePostTool.handler as (args: unknown, ctx: unknown) => Promise<unknown>)(
      {
        topic: "Integration Topic",
        title: state.title,
        finalPost: state.finalPost,
        sources: [{ title: "Source A", url: "https://a.example.com" }],
      },
      { network: { state: { data: state } } }
    );
    await updateStage(postId, "publish", { state: "done", endedAt: new Date() });

    // --- Router reports done; no further agent to run ----------------------
    expect(routeNext(state, agents)).toBeUndefined();
    expect(state.published).toBe(true);

    // --- Assert the persisted doc reached "done" with populated fields ---
    const final = await getPostById(postId);
    expect(final?.status).toBe("done");
    expect(final?.title).toBe("Integration Topic: A Deep Dive");
    expect(final?.finalPost).toBe("The polished final article body.");
    expect(final?.posterImageId).toBeTruthy();
    expect(final?.sources).toEqual([{ title: "Source A", url: "https://a.example.com" }]);
    expect(final?.stages.publish.state).toBe("done");
    expect(final?.stages.research.state).toBe("done");
    expect((final?.research ?? []).length).toBeGreaterThan(0);
  });
});
