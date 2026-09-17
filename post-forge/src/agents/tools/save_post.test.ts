/**
 * `save_post` tool tests (T18 BRD §4.3): idempotency per `runId`.
 *
 * Mongo is stubbed with the same in-memory `FakeDb`/`FakeCollection` used
 * by `posts-repo.test.ts` (see that file's header for why -- this
 * environment's `npm install` couldn't reliably be trusted to also pull
 * down `mongodb-memory-server`'s binary). This test deliberately does NOT
 * mock `@/lib/posts-repo` itself, so it exercises the real
 * `upsertFinalPost` upsert-by-runId logic the tool depends on for
 * idempotency, not a mocked stand-in for it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeDb } from "@/lib/test-helpers/fake-mongo";

let fakeDb = new FakeDb();
vi.mock("@/lib/mongo", () => ({
  getDb: async () => fakeDb,
}));

beforeEach(() => {
  fakeDb = new FakeDb();
});

import { savePostTool, SavePostToolError } from "./save_post";
import { getPostByRunId, listPosts } from "@/lib/posts-repo";
import type { NetworkState } from "@/lib/state";

function fakeNetwork(state: NetworkState) {
  return { network: { state: { data: state } } };
}

async function call(
  input: { topic: string; title?: string; finalPost?: string; sources?: { title: string; url: string }[] },
  state: NetworkState
) {
  const ctx = fakeNetwork(state);
  const result = await (
    savePostTool.handler as (args: unknown, ctx: unknown) => Promise<{ postId: string }>
  )(input, ctx);
  return { result, state: ctx.network.state.data };
}

describe("save_post tool", () => {
  it("persists the post, marks state.published/postId, and one Mongo doc exists", async () => {
    const state: NetworkState = { runId: "run-save-1", options: {} };
    const { result, state: after } = await call(
      { topic: "World Cup 2026", title: "Big Preview", finalPost: "The final article body." },
      state
    );

    expect(result.postId).toBeTruthy();
    expect(after.published).toBe(true);
    expect(after.postId).toBe(result.postId);

    const doc = await getPostByRunId("run-save-1");
    expect(doc?.status).toBe("done");
    expect(doc?.title).toBe("Big Preview");
    expect(doc?.finalPost).toBe("The final article body.");

    const { total } = await listPosts();
    expect(total).toBe(1);
  });

  it("is idempotent: calling save_post twice for the same runId updates one doc, not two", async () => {
    const state: NetworkState = { runId: "run-save-idem", options: {} };

    const first = await call({ topic: "Topic", finalPost: "v1" }, state);
    const second = await call({ topic: "Topic", finalPost: "v2" }, { ...state });

    expect(second.result.postId).toBe(first.result.postId);

    const { total, items } = await listPosts();
    expect(total).toBe(1);
    expect(items[0].finalPost).toBe("v2");
  });

  it("throws a named SavePostToolError when runId is missing from network state", async () => {
    const ctx = fakeNetwork({ runId: "", options: {} });
    // Empty string runId is falsy, same guard path as a genuinely missing one.
    await expect(
      (savePostTool.handler as (args: unknown, ctx: unknown) => Promise<unknown>)(
        { topic: "x" },
        ctx
      )
    ).rejects.toThrow(SavePostToolError);
  });

  it("defaults sources to an empty array when the model omits them", async () => {
    const { result } = await call({ topic: "No sources here" }, { runId: "run-no-src", options: {} });
    const doc = await getPostByRunId("run-no-src");
    expect(doc?.sources).toEqual([]);
    expect(result.postId).toBe(doc?._id.toString());
  });

  it("has strict:false so optional fields don't require strict function-calling mode", () => {
    expect(savePostTool.strict).toBe(false);
  });
});
