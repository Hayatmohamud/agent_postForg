/**
 * Hot-reload-safe MongoDB client + GridFS bucket.
 *
 * In dev, Next.js hot-reloads modules on every edit, which would otherwise
 * create a fresh `MongoClient` (and connection pool) per reload. We cache
 * the client (and the one-time index-creation promise) on `globalThis` so
 * the same client/connection is reused across reloads, mirroring the
 * standard Next.js + MongoDB pattern.
 */

import { MongoClient, GridFSBucket, type Db } from "mongodb";
import { requireEnv } from "./env";

const POSTERS_BUCKET = "posters";

type MongoGlobal = typeof globalThis & {
  __postforgeMongoClientPromise?: Promise<MongoClient>;
  __postforgeIndexesEnsured?: Promise<void>;
};

const globalForMongo = globalThis as MongoGlobal;

function createClient(): Promise<MongoClient> {
  const uri = requireEnv("MONGODB_URI");
  const client = new MongoClient(uri);
  return client.connect();
}

/** Returns the cached (or newly created) `MongoClient` connection promise. */
function getClientPromise(): Promise<MongoClient> {
  if (!globalForMongo.__postforgeMongoClientPromise) {
    globalForMongo.__postforgeMongoClientPromise = createClient();
  }
  return globalForMongo.__postforgeMongoClientPromise;
}

/** Ensures the `posts` collection indexes exist. Runs once per process. */
function ensureIndexes(db: Db): Promise<void> {
  if (!globalForMongo.__postforgeIndexesEnsured) {
    globalForMongo.__postforgeIndexesEnsured = (async () => {
      const posts = db.collection("posts");
      await Promise.all([
        posts.createIndex({ createdAt: -1 }),
        posts.createIndex({ status: 1 }),
        posts.createIndex({ topic: "text" }),
        posts.createIndex({ runId: 1 }, { unique: true }),
      ]);
    })();
  }
  return globalForMongo.__postforgeIndexesEnsured;
}

/** Returns the PostForge database, ensuring indexes are created first. */
export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  const db = client.db();
  await ensureIndexes(db);
  return db;
}

/** Returns the `posters` GridFS bucket used to store poster image bytes. */
export async function getBucket(): Promise<GridFSBucket> {
  const db = await getDb();
  return new GridFSBucket(db, { bucketName: POSTERS_BUCKET });
}
