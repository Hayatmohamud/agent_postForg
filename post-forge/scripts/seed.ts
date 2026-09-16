/**
 * Seed / demo data script (T17).
 *
 * Populates the `posts` collection (varied statuses incl. done/failed/
 * in-progress with realistic stages/subProgress/sources/telemetry), a few
 * placeholder poster images in the `posters` GridFS bucket (no paid image
 * API calls — bytes are generated locally), and a couple of sample
 * `schedules` documents (T14's collection, seeded ahead of that task — see
 * the `Schedule` type below and the matching report filed in
 * tasks/reports.jsonl for T14's future implementer).
 *
 * Idempotent: every document uses a fixed, hardcoded `_id` (and GridFS file
 * id), so re-running replaces the same records in place instead of
 * duplicating them. Safe to run as many times as you like.
 *
 * Writes posts only through the canonical `Post`/`Finding`/`Stage` shapes
 * from `src/lib/state.ts` (T02), via the same `getDb()`/`getBucket()`
 * accessors (and the same GridFS `{mime, postId}` metadata contract) the
 * real pipeline (T03's `generate_poster`/`save_post` tools) uses, so seeded
 * data is indistinguishable from a real run.
 */

// `tsx scripts/seed.ts` runs outside Next.js, so `.env` isn't auto-loaded —
// load it the same way `next dev`/`next build` would pick it up.
try {
  process.loadEnvFile();
} catch {
  // No .env file present (e.g. CI, or vars already in the environment) —
  // src/lib/env.ts's requireEnv() will raise a clear MissingEnvError later
  // if something required is actually missing.
}

import { ObjectId } from "mongodb";
import { deflateSync } from "node:zlib";
import { getDb, getBucket } from "../src/lib/mongo";
import { initialStages, type Post, type Stage, type StageState } from "../src/lib/state";

// ---------------------------------------------------------------------------
// Deterministic, fixed ids for idempotency. Never regenerate these.
// ---------------------------------------------------------------------------
const SEED_IDS = {
  postDone1: new ObjectId("650000000000000000000001"),
  postDone2: new ObjectId("650000000000000000000002"),
  postFailed: new ObjectId("650000000000000000000003"),
  postInProgress: new ObjectId("650000000000000000000004"),
  posterDone1: new ObjectId("650000000000000000000101"),
  posterDone2: new ObjectId("650000000000000000000102"),
  posterFailed: new ObjectId("650000000000000000000103"),
  scheduleEnabled: new ObjectId("650000000000000000000201"),
  scheduleDisabled: new ObjectId("650000000000000000000202"),
};

// ---------------------------------------------------------------------------
// Minimal, dependency-free PNG encoder — produces a small solid-color PNG so
// seeding never needs the paid poster image API. Implements its own CRC32
// (rather than relying on the newer `zlib.crc32`, which isn't available on
// Node 20) so this runs on any Node version the project supports.
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** Builds a tiny solid-color RGB PNG (no external deps) as a placeholder poster. */
function makePlaceholderPng(
  [r, g, b]: [number, number, number],
  size = 64
): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type: truecolor (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = pngChunk("IHDR", ihdrData);

  const rowSize = size * 3;
  const raw = Buffer.alloc((rowSize + 1) * size);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (rowSize + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const off = rowStart + 1 + x * 3;
      raw[off] = r;
      raw[off + 1] = g;
      raw[off + 2] = b;
    }
  }
  const idat = pngChunk("IDAT", deflateSync(raw));
  const iend = pngChunk("IEND", Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// ---------------------------------------------------------------------------
// Post fixtures
// ---------------------------------------------------------------------------
function stages(overrides: Partial<Record<Stage, StageState>>): Record<Stage, StageState> {
  return { ...initialStages(), ...overrides };
}

function doneStage(startedAt: Date, endedAt: Date, detail: string): StageState {
  return { state: "done", startedAt, endedAt, detail };
}

function buildDonePost(
  id: ObjectId,
  topic: string,
  posterId: ObjectId,
  baseTime: number
): Post {
  const t = (offsetMin: number) => new Date(baseTime + offsetMin * 60_000);
  return {
    _id: id,
    topic,
    status: "done",
    stages: stages({
      research: doneStage(t(0), t(1), "Found 5 sources"),
      verify: doneStage(t(1), t(2), "Verified 4 of 5 claims"),
      write: doneStage(t(2), t(4), "Drafted 620 words"),
      edit: doneStage(t(4), t(5), "Polished tone + structure"),
      illustrate: doneStage(t(5), t(6), "Poster generated"),
      publish: doneStage(t(6), t(6.2), "Saved to MongoDB"),
    }),
    subProgress: [
      { stage: "research", kind: "source_found", data: { title: "Overview article", url: "https://example.com/overview" }, at: t(0.3) },
      { stage: "verify", kind: "claim_checked", data: { claim: "Key fact confirmed", verified: true }, at: t(1.5) },
      { stage: "write", kind: "draft_progress", data: { words: 620 }, at: t(3.5) },
      { stage: "illustrate", kind: "poster_prompt", data: { prompt: `A clean editorial poster illustrating: ${topic}` }, at: t(5.5) },
    ],
    research: [
      { claim: "This topic has broad public interest.", source: { title: "Overview article", url: "https://example.com/overview" }, verified: true },
      { claim: "Recent developments are well documented.", source: { title: "News recap", url: "https://example.com/recap" }, verified: true },
    ],
    verifiedFindings: [
      { claim: "This topic has broad public interest.", source: { title: "Overview article", url: "https://example.com/overview" }, verified: true },
    ],
    title: `${topic}: What You Need to Know`,
    draft: `A first-pass draft covering ${topic}, grounded in verified sources.`,
    finalPost: `# ${topic}: What You Need to Know\n\nAn edited, publish-ready article about ${topic}, grounded in verified sources and polished for tone and clarity.`,
    sources: [
      { title: "Overview article", url: "https://example.com/overview" },
      { title: "News recap", url: "https://example.com/recap" },
    ],
    posterImageId: posterId.toString(),
    options: { tone: "informative", length: "medium" },
    telemetry: {
      tokensByAgent: { research: 1800, verify: 1200, writer: 2600, editor: 1400, illustrator: 300, publisher: 50 },
      timingsByStage: { research: 60_000, verify: 60_000, write: 120_000, edit: 60_000, illustrate: 60_000, publish: 12_000 },
    },
    runId: `seed-done-${id.toHexString()}`,
    createdAt: t(0),
    updatedAt: t(6.2),
  };
}

function buildFailedPost(id: ObjectId, posterId: ObjectId, baseTime: number): Post {
  const t = (offsetMin: number) => new Date(baseTime + offsetMin * 60_000);
  const topic = "Quantum Computing Breakthroughs in 2026";
  return {
    _id: id,
    topic,
    status: "failed",
    stages: stages({
      research: doneStage(t(0), t(1), "Found 4 sources"),
      verify: doneStage(t(1), t(2), "Verified 3 of 4 claims"),
      write: doneStage(t(2), t(4), "Drafted 580 words"),
      edit: doneStage(t(4), t(5), "Polished tone + structure"),
      illustrate: doneStage(t(5), t(6), "Poster generated"),
      publish: { state: "failed", startedAt: t(6), endedAt: t(6.1), detail: "Mongo write rejected" },
    }),
    subProgress: [
      { stage: "research", kind: "source_found", data: { title: "Research digest", url: "https://example.com/quantum" }, at: t(0.3) },
      { stage: "publish", kind: "error", data: { message: "Simulated transient write failure" }, at: t(6.1) },
    ],
    research: [
      { claim: "Error-corrected qubits crossed a new milestone.", source: { title: "Research digest", url: "https://example.com/quantum" }, verified: true },
    ],
    verifiedFindings: [
      { claim: "Error-corrected qubits crossed a new milestone.", source: { title: "Research digest", url: "https://example.com/quantum" }, verified: true },
    ],
    title: "Quantum Computing's Next Milestone",
    draft: "A draft covering the latest quantum computing breakthroughs.",
    finalPost: "# Quantum Computing's Next Milestone\n\nAn edited article about recent quantum computing breakthroughs.",
    sources: [{ title: "Research digest", url: "https://example.com/quantum" }],
    posterImageId: posterId.toString(),
    options: { tone: "informative", length: "short" },
    telemetry: {
      tokensByAgent: { research: 1500, verify: 1000, writer: 2200, editor: 1100, illustrator: 300 },
      timingsByStage: { research: 60_000, verify: 60_000, write: 120_000, edit: 60_000, illustrate: 60_000, publish: 6_000 },
    },
    runId: `seed-failed-${id.toHexString()}`,
    createdAt: t(0),
    updatedAt: t(6.1),
    error: { stage: "publish", message: "Simulated transient write failure" },
  };
}

function buildInProgressPost(id: ObjectId, baseTime: number): Post {
  const t = (offsetMin: number) => new Date(baseTime + offsetMin * 60_000);
  const topic = "The Future of Renewable Energy Storage";
  return {
    _id: id,
    topic,
    status: "writing",
    stages: stages({
      research: doneStage(t(0), t(1), "Found 6 sources"),
      verify: doneStage(t(1), t(2), "Verified 5 of 6 claims"),
      write: { state: "active", startedAt: t(2), detail: "Drafting..." },
    }),
    subProgress: [
      { stage: "research", kind: "source_found", data: { title: "Energy storage report", url: "https://example.com/energy" }, at: t(0.4) },
      { stage: "verify", kind: "claim_checked", data: { claim: "Battery costs are falling", verified: true }, at: t(1.6) },
      { stage: "write", kind: "draft_progress", data: { words: 210 }, at: t(2.5) },
    ],
    research: [
      { claim: "Battery costs are falling year over year.", source: { title: "Energy storage report", url: "https://example.com/energy" }, verified: true },
    ],
    verifiedFindings: [
      { claim: "Battery costs are falling year over year.", source: { title: "Energy storage report", url: "https://example.com/energy" }, verified: true },
    ],
    sources: [{ title: "Energy storage report", url: "https://example.com/energy" }],
    options: { tone: "informative", length: "medium" },
    telemetry: {
      tokensByAgent: { research: 1600, verify: 1100, writer: 800 },
      timingsByStage: { research: 60_000, verify: 60_000 },
    },
    runId: `seed-in-progress-${id.toHexString()}`,
    createdAt: t(0),
    updatedAt: t(2.5),
  };
}

// ---------------------------------------------------------------------------
// Schedule fixtures (T14's collection — that task hasn't landed yet, so this
// is a forward-looking type. See tasks/reports.jsonl for the info report
// documenting this shape for T14's implementer to adopt.)
// ---------------------------------------------------------------------------
type Schedule = {
  _id: ObjectId;
  topic: string;
  cadence: "daily" | "weekly";
  enabled: boolean;
  nextRunAt: Date;
  lastResult?: { status: "success" | "failure"; at: Date; postId?: string };
  createdAt: Date;
  updatedAt: Date;
};

function buildSchedules(now: Date, doneRunPostId: ObjectId): Schedule[] {
  const dayMs = 24 * 60 * 60 * 1000;
  return [
    {
      _id: SEED_IDS.scheduleEnabled,
      topic: "Daily AI News Roundup",
      cadence: "daily",
      enabled: true,
      nextRunAt: new Date(now.getTime() + dayMs),
      lastResult: { status: "success", at: new Date(now.getTime() - dayMs), postId: doneRunPostId.toString() },
      createdAt: new Date(now.getTime() - 7 * dayMs),
      updatedAt: now,
    },
    {
      _id: SEED_IDS.scheduleDisabled,
      topic: "Weekly Space Exploration Digest",
      cadence: "weekly",
      enabled: false,
      nextRunAt: new Date(now.getTime() + 7 * dayMs),
      createdAt: new Date(now.getTime() - 14 * dayMs),
      updatedAt: now,
    },
  ];
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------
async function seedPoster(
  bucket: Awaited<ReturnType<typeof getBucket>>,
  id: ObjectId,
  color: [number, number, number],
  postId: ObjectId
): Promise<void> {
  // Idempotency: delete any prior file at this fixed id before re-uploading
  // (GridFS has no upsert-by-id upload).
  try {
    await bucket.delete(id);
  } catch {
    // Not found on a first run — expected, ignore.
  }
  const bytes = makePlaceholderPng(color);
  await new Promise<void>((resolve, reject) => {
    const uploadStream = bucket.openUploadStreamWithId(id, `seed-poster-${id.toHexString()}`, {
      metadata: { mime: "image/png", postId: postId.toString() },
    });
    uploadStream.once("error", reject);
    uploadStream.once("finish", () => resolve());
    uploadStream.end(bytes);
  });
}

async function main(): Promise<void> {
  const db = await getDb();
  const bucket = await getBucket();
  const now = new Date();
  const baseTime = now.getTime() - 3 * 60 * 60 * 1000; // 3 hours ago

  console.log("[seed] Seeding posts...");
  const posts = db.collection<Post>("posts");
  const donePost1 = buildDonePost(SEED_IDS.postDone1, "World Cup 2026: A Preview", SEED_IDS.posterDone1, baseTime);
  const donePost2 = buildDonePost(SEED_IDS.postDone2, "The Rise of On-Device AI", SEED_IDS.posterDone2, baseTime + 30 * 60_000);
  const failedPost = buildFailedPost(SEED_IDS.postFailed, SEED_IDS.posterFailed, baseTime + 60 * 60_000);
  const inProgressPost = buildInProgressPost(SEED_IDS.postInProgress, baseTime + 90 * 60_000);

  for (const doc of [donePost1, donePost2, failedPost, inProgressPost]) {
    await posts.replaceOne({ _id: doc._id }, doc, { upsert: true });
  }
  console.log("[seed] Upserted 4 posts (2 done, 1 failed, 1 in-progress).");

  console.log("[seed] Seeding poster images (GridFS placeholders)...");
  await seedPoster(bucket, SEED_IDS.posterDone1, [220, 60, 60], SEED_IDS.postDone1);
  await seedPoster(bucket, SEED_IDS.posterDone2, [60, 140, 220], SEED_IDS.postDone2);
  await seedPoster(bucket, SEED_IDS.posterFailed, [80, 180, 100], SEED_IDS.postFailed);
  console.log("[seed] Upserted 3 poster images.");

  console.log("[seed] Seeding schedules...");
  const schedules = db.collection<Schedule>("schedules");
  for (const doc of buildSchedules(now, SEED_IDS.postDone1)) {
    await schedules.replaceOne({ _id: doc._id }, doc, { upsert: true });
  }
  console.log("[seed] Upserted 2 schedules (1 enabled, 1 disabled).");

  console.log("[seed] Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    // getDb() keeps a cached MongoClient connection open (by design, for
    // hot-reload reuse in the running app) — explicitly exit so this
    // one-off script doesn't hang after finishing.
    process.exit(process.exitCode ?? 0);
  });
