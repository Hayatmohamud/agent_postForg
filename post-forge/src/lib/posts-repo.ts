/**
 * Posts repository: the canonical persistence contract for the `posts`
 * collection, consumed by tools (T03), agents (T04), the generate function
 * (T05), API routes (T06), analytics (T13), and the seed script (T17).
 *
 * All mutating helpers use scoped `$set`/`$push` updates so a single
 * stage/field update never clobbers sibling fields, and always bump
 * `updatedAt`.
 */

import { Collection, ObjectId } from "mongodb";
import { getDb } from "./mongo";
import {
  initialStages,
  type Finding,
  type GenerationOptions,
  type Post,
  type PostStatus,
  type Stage,
  type SubProgressEntry,
} from "./state";

async function postsCollection(): Promise<Collection<Post>> {
  const db = await getDb();
  return db.collection<Post>("posts");
}

function toObjectId(id: string | ObjectId): ObjectId {
  return id instanceof ObjectId ? id : new ObjectId(id);
}

/** Creates a new post document in the `researching` status. */
export async function createPost(
  topic: string,
  runId: string,
  options: GenerationOptions = {}
): Promise<Post> {
  const posts = await postsCollection();
  const now = new Date();
  const doc: Post = {
    _id: new ObjectId(),
    topic,
    status: "researching",
    stages: initialStages(),
    subProgress: [],
    research: [],
    verifiedFindings: [],
    sources: [],
    options,
    telemetry: { tokensByAgent: {}, timingsByStage: {} },
    runId,
    createdAt: now,
    updatedAt: now,
  };
  await posts.insertOne(doc);
  return doc;
}

/** Fetches a single post by its `_id`. Returns `null` if not found. */
export async function getPostById(id: string | ObjectId): Promise<Post | null> {
  const posts = await postsCollection();
  return posts.findOne({ _id: toObjectId(id) });
}

/** Fetches a single post by its `runId`. Returns `null` if not found. */
export async function getPostByRunId(runId: string): Promise<Post | null> {
  const posts = await postsCollection();
  return posts.findOne({ runId });
}

/** Statuses that mean a run has finished (successfully or not). */
const TERMINAL_STATUSES: PostStatus[] = ["done", "failed"];

/**
 * Counts posts whose status is not yet terminal (`done`/`failed`) — i.e.
 * still actively running a generation. Used by T19's concurrency/quota
 * guard on `POST /api/generate`.
 */
export async function countInFlightPosts(): Promise<number> {
  const posts = await postsCollection();
  return posts.countDocuments({ status: { $nin: TERMINAL_STATUSES } });
}

/** Lightweight projection of a post used by T19's dedupe guard. */
export type PostDedupeProjection = {
  id: string;
  topic: string;
  status: PostStatus;
  createdAt: Date;
};

/**
 * Fetches `{id, topic, status, createdAt}` for every post created at or
 * after `since`. Used by T19's dedupe guard, which does the actual
 * topic-normalization matching in pure JS (`src/lib/generation-guards.ts`)
 * rather than trying to express normalized-text matching as a Mongo query.
 */
export async function findPostsSince(since: Date): Promise<PostDedupeProjection[]> {
  const posts = await postsCollection();
  const docs = await posts
    .find(
      { createdAt: { $gte: since } },
      { projection: { topic: 1, status: 1, createdAt: 1 } }
    )
    .toArray();
  return docs.map((doc) => ({
    id: doc._id.toString(),
    topic: doc.topic,
    status: doc.status,
    createdAt: doc.createdAt,
  }));
}

export type ListPostsQuery = {
  search?: string;
  status?: PostStatus;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export type ListPostsResult = {
  items: Post[];
  total: number;
  page: number;
  pageSize: number;
};

/** Lists posts with optional text search, status/date filters, and paging. */
export async function listPosts(query: ListPostsQuery = {}): Promise<ListPostsResult> {
  const posts = await postsCollection();
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;

  const filter: Record<string, unknown> = {};
  if (query.search) {
    filter.$text = { $search: query.search };
  }
  if (query.status) {
    filter.status = query.status;
  }
  if (query.from || query.to) {
    const createdAt: Record<string, Date> = {};
    if (query.from) createdAt.$gte = query.from;
    if (query.to) createdAt.$lte = query.to;
    filter.createdAt = createdAt;
  }

  const cursor = posts
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize);

  const [items, total] = await Promise.all([
    cursor.toArray(),
    posts.countDocuments(filter),
  ]);

  return { items, total, page, pageSize };
}

/**
 * Merges `patch` into `stages.<stage>` and, if `status` is provided, also
 * sets the top-level `status`. Scoped to the one stage so siblings are
 * untouched.
 */
export async function updateStage(
  id: string | ObjectId,
  stage: Stage,
  patch: Partial<{
    state: "queued" | "active" | "done" | "failed";
    startedAt: Date;
    endedAt: Date;
    detail: string;
  }>,
  status?: PostStatus
): Promise<void> {
  const posts = await postsCollection();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(patch)) {
    set[`stages.${stage}.${key}`] = value;
  }
  if (status) {
    set.status = status;
  }
  await posts.updateOne({ _id: toObjectId(id) }, { $set: set });
}

/** Appends one sub-progress entry without touching any other field. */
export async function appendSubProgress(
  id: string | ObjectId,
  entry: SubProgressEntry
): Promise<void> {
  const posts = await postsCollection();
  await posts.updateOne(
    { _id: toObjectId(id) },
    { $push: { subProgress: entry }, $set: { updatedAt: new Date() } }
  );
}

/** Sets the top-level `status`, optionally recording an error alongside it. */
export async function setStatus(
  id: string | ObjectId,
  status: PostStatus,
  error?: { stage?: Stage; message: string }
): Promise<void> {
  const posts = await postsCollection();
  const set: Record<string, unknown> = { status, updatedAt: new Date() };
  if (error) {
    set.error = error;
  }
  await posts.updateOne({ _id: toObjectId(id) }, { $set: set });
}

/** Overwrites the `sources` list (final, deduplicated source list). */
export async function saveSources(
  id: string | ObjectId,
  sources: { title: string; url: string }[]
): Promise<void> {
  const posts = await postsCollection();
  await posts.updateOne(
    { _id: toObjectId(id) },
    { $set: { sources, updatedAt: new Date() } }
  );
}

/**
 * Increments telemetry counters (tokens per agent, ms per stage) without
 * clobbering other telemetry keys.
 */
export async function recordTelemetry(
  id: string | ObjectId,
  telemetry: { agent?: string; tokens?: number; stage?: Stage; ms?: number }
): Promise<void> {
  const posts = await postsCollection();
  const inc: Record<string, number> = {};
  if (telemetry.agent && telemetry.tokens) {
    inc[`telemetry.tokensByAgent.${telemetry.agent}`] = telemetry.tokens;
  }
  if (telemetry.stage && telemetry.ms) {
    inc[`telemetry.timingsByStage.${telemetry.stage}`] = telemetry.ms;
  }
  if (Object.keys(inc).length === 0) {
    return;
  }
  await posts.updateOne(
    { _id: toObjectId(id) },
    { $inc: inc, $set: { updatedAt: new Date() } }
  );
}

/** Records a stage failure: sets `status: "failed"` and the `error` field. */
export async function recordError(
  id: string | ObjectId,
  stage: Stage,
  message: string
): Promise<void> {
  await setStatus(id, "failed", { stage, message });
}

/**
 * Fields the `save_post` tool (T03) writes when finalizing a run. `topic`
 * is required (the network state doesn't carry it); everything else is
 * optional so a partial/degraded run can still persist what it has.
 */
export type FinalPostFields = {
  topic: string;
  title?: string;
  draft?: string;
  finalPost?: string;
  research?: Finding[];
  verifiedFindings?: Finding[];
  sources?: { title: string; url: string }[];
  posterImageId?: string;
  options?: GenerationOptions;
};

/**
 * Upserts the complete `Post` document for a run, keyed by `runId` for
 * idempotency: re-running with the same `runId` updates the existing
 * document in place rather than creating a duplicate. Moves `status`
 * to `"done"`. Used by the `save_post` tool (T03) to persist the final
 * pipeline output; also usable standalone (e.g. by T17's seed script)
 * since it creates the document via `$setOnInsert` if one doesn't
 * already exist for that `runId`.
 */
export async function upsertFinalPost(
  runId: string,
  fields: FinalPostFields
): Promise<Post> {
  const posts = await postsCollection();
  const now = new Date();

  const set: Record<string, unknown> = { updatedAt: now, status: "done" as PostStatus };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      set[key] = value;
    }
  }

  const setOnInsertCandidate: Record<string, unknown> = {
    _id: new ObjectId(),
    runId,
    topic: fields.topic,
    stages: initialStages(),
    subProgress: [],
    research: [],
    verifiedFindings: [],
    sources: [],
    options: fields.options ?? {},
    telemetry: { tokensByAgent: {}, timingsByStage: {} },
    createdAt: now,
  };
  // Mongo forbids the same path in both $set and $setOnInsert.
  const setOnInsert: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(setOnInsertCandidate)) {
    if (!(key in set)) {
      setOnInsert[key] = value;
    }
  }

  await posts.updateOne(
    { runId },
    { $set: set, $setOnInsert: setOnInsert },
    { upsert: true }
  );

  const doc = await posts.findOne({ runId });
  if (!doc) {
    throw new Error(`upsertFinalPost: post not found for runId ${runId} after upsert`);
  }
  return doc;
}
