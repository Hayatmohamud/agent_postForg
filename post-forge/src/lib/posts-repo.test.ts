/**
 * Repository tests (T18 BRD §4.2) for `posts-repo.ts`.
 *
 * Mongo test strategy: mocked repository layer, not `mongodb-memory-server`.
 * This worktree's `npm install` repeatedly failed with filesystem-locking
 * errors (ENOENT/ENOTEMPTY mid-tar-extraction) even for packages already
 * declared in package.json -- almost certainly contention from this
 * machine's OneDrive-synced `Desktop` folder, the same class of environment
 * fragility T01 hit with `inngest-cli`'s postinstall (R-0001). Adding
 * `mongodb-memory-server`'s own platform-binary download on top of that was
 * judged impractical to depend on for a "must be green" suite. See
 * `src/lib/test-helpers/fake-mongo.ts` for the in-memory stand-in used
 * instead, and tasks/reports.jsonl for the filed report.
 *
 * `vi.mock("./mongo")` swaps `getDb()` for a `FakeDb` backed by
 * `FakeCollection`, which implements real dot-path `$set`/`$push`/`$inc`
 * and filter semantics -- so these tests exercise the repository's actual
 * update-scoping logic (e.g. `updateStage` only touching one stage's
 * fields), not just that it calls some mocked function.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { FakeDb } from "./test-helpers/fake-mongo";

let fakeDb = new FakeDb();

vi.mock("./mongo", () => ({
  getDb: async () => fakeDb,
}));

// Fresh in-memory "database" per test so describe blocks (createPost,
// updateStage, listPosts, upsertFinalPost) never see each other's docs.
beforeEach(() => {
  fakeDb = new FakeDb();
});

import {
  createPost,
  getPostById,
  getPostByRunId,
  listPosts,
  updateStage,
  upsertFinalPost,
} from "./posts-repo";

describe("createPost", () => {
  it("creates a doc with the expected initial shape", async () => {
    const doc = await createPost("World Cup 2026", "run-abc", { tone: "witty" });

    expect(doc.topic).toBe("World Cup 2026");
    expect(doc.runId).toBe("run-abc");
    expect(doc.status).toBe("researching");
    expect(doc.options).toEqual({ tone: "witty" });
    expect(doc.research).toEqual([]);
    expect(doc.verifiedFindings).toEqual([]);
    expect(doc.sources).toEqual([]);
    expect(doc.subProgress).toEqual([]);
    expect(doc._id).toBeInstanceOf(ObjectId);
    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.updatedAt).toBeInstanceOf(Date);

    // All six stages start queued.
    for (const stage of ["research", "verify", "write", "edit", "illustrate", "publish"] as const) {
      expect(doc.stages[stage]).toEqual({ state: "queued" });
    }

    const fetched = await getPostById(doc._id);
    expect(fetched?.topic).toBe("World Cup 2026");
  });
});

describe("updateStage", () => {
  it("mutates only the targeted stage's fields, leaving siblings untouched", async () => {
    const doc = await createPost("Topic A", "run-scoped");

    const before = new Date(2020, 0, 1);
    // Give every other stage a distinguishable "detail" first.
    await updateStage(doc._id, "verify", { state: "active", detail: "verify-untouched" });
    await updateStage(doc._id, "write", { state: "queued", detail: "write-untouched" });

    await updateStage(
      doc._id,
      "research",
      { state: "done", startedAt: before, endedAt: new Date(2020, 0, 2), detail: "research-detail" },
      "verifying"
    );

    const after = await getPostById(doc._id);
    expect(after?.stages.research.state).toBe("done");
    expect(after?.stages.research.detail).toBe("research-detail");
    expect(after?.stages.research.startedAt).toBeTruthy();

    // Siblings must be unaffected by the research update.
    expect(after?.stages.verify).toEqual({ state: "active", detail: "verify-untouched" });
    expect(after?.stages.write).toEqual({ state: "queued", detail: "write-untouched" });
    expect(after?.stages.edit).toEqual({ state: "queued" });
    expect(after?.stages.illustrate).toEqual({ state: "queued" });
    expect(after?.stages.publish).toEqual({ state: "queued" });

    // Top-level status was updated as requested, alongside the stage.
    expect(after?.status).toBe("verifying");
  });

  it("does not require a status change, leaving status untouched when omitted", async () => {
    const doc = await createPost("Topic B", "run-status-omit");
    await updateStage(doc._id, "write", { state: "active" });
    const after = await getPostById(doc._id);
    expect(after?.status).toBe("researching"); // unchanged
    expect(after?.stages.write.state).toBe("active");
  });
});

describe("listPosts", () => {
  beforeEach(async () => {
    await createPost("Alpha launch", "run-1", {});
    await createPost("Beta rollout", "run-2", {});
    await createPost("Gamma alpha rerun", "run-3", {});
    // Give run-2 a distinct status for the status filter test.
    const beta = await getPostByRunId("run-2");
    if (beta) await updateStage(beta._id, "publish", { state: "done" }, "done");
  });

  it("filters by status", async () => {
    const result = await listPosts({ status: "done" });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].runId).toBe("run-2");
  });

  it("filters by search substring against topic", async () => {
    const result = await listPosts({ search: "alpha" });
    const topics = result.items.map((p) => p.topic).sort();
    expect(topics).toEqual(["Alpha launch", "Gamma alpha rerun"]);
  });

  it("paginates with page/pageSize", async () => {
    const page1 = await listPosts({ page: 1, pageSize: 2 });
    const page2 = await listPosts({ page: 2, pageSize: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(1);
    expect(page1.total).toBe(3);
    expect(page2.total).toBe(3);
    expect(page1.page).toBe(1);
    expect(page2.page).toBe(2);
    // No overlap between pages.
    const ids1 = page1.items.map((p) => p._id.toString());
    const ids2 = page2.items.map((p) => p._id.toString());
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it("defaults to page 1 / pageSize 20 when unset", async () => {
    const result = await listPosts();
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.items.length).toBe(3);
  });
});

describe("upsertFinalPost", () => {
  it("is idempotent per runId: a second call updates, not duplicates", async () => {
    const first = await upsertFinalPost("run-idempotent", {
      topic: "Idempotency check",
      title: "First title",
      finalPost: "first body",
    });
    const second = await upsertFinalPost("run-idempotent", {
      topic: "Idempotency check",
      title: "Second title",
      finalPost: "second body",
    });

    expect(first._id.toString()).toBe(second._id.toString());
    expect(second.title).toBe("Second title");
    expect(second.status).toBe("done");

    const result = await listPosts({ search: "idempotency" });
    expect(result.items).toHaveLength(1);
  });
});
