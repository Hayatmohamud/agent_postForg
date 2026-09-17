/**
 * Schedules repository: data-access helpers over the `schedules` collection
 * (T14 BRD 4.1).
 *
 * Adopts the exact `Schedule` shape T17 already seeded ahead of this task
 * (see `scripts/seed.ts` and `tasks/reports.jsonl` R-0008), rather than
 * inventing a conflicting one, so the already-seeded schedules render
 * correctly once the `/scheduled` screen is built:
 *
 *   { _id, topic, cadence: "daily" | "weekly", enabled, nextRunAt,
 *     lastResult?: { status: "success" | "failure", at, postId? },
 *     createdAt, updatedAt }
 */

import { Collection, ObjectId } from "mongodb";
import { getDb } from "./mongo";

export type Cadence = "daily" | "weekly";

export type ScheduleLastResult = {
  status: "success" | "failure";
  at: Date;
  postId?: string;
};

export type Schedule = {
  _id: ObjectId;
  topic: string;
  cadence: Cadence;
  enabled: boolean;
  nextRunAt: Date;
  lastResult?: ScheduleLastResult;
  createdAt: Date;
  updatedAt: Date;
};

const CADENCE_MS: Record<Cadence, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

/** Computes the next run time for a cadence, relative to `from` (default: now). */
export function computeNextRunAt(cadence: Cadence, from: Date = new Date()): Date {
  return new Date(from.getTime() + CADENCE_MS[cadence]);
}

async function schedulesCollection(): Promise<Collection<Schedule>> {
  const db = await getDb();
  return db.collection<Schedule>("schedules");
}

function toObjectId(id: string | ObjectId): ObjectId {
  return id instanceof ObjectId ? id : new ObjectId(id);
}

export type CreateScheduleInput = {
  topic: string;
  cadence: Cadence;
  enabled?: boolean;
  /** Defaults to `computeNextRunAt(cadence)` (now + one cadence period) if unset. */
  nextRunAt?: Date;
};

/** Creates a new schedule document. */
export async function createSchedule(input: CreateScheduleInput): Promise<Schedule> {
  const schedules = await schedulesCollection();
  const now = new Date();
  const doc: Schedule = {
    _id: new ObjectId(),
    topic: input.topic,
    cadence: input.cadence,
    enabled: input.enabled ?? true,
    nextRunAt: input.nextRunAt ?? computeNextRunAt(input.cadence, now),
    createdAt: now,
    updatedAt: now,
  };
  await schedules.insertOne(doc);
  return doc;
}

/** Lists all schedules, most-recently-created first. */
export async function listSchedules(): Promise<Schedule[]> {
  const schedules = await schedulesCollection();
  return schedules.find({}).sort({ createdAt: -1 }).toArray();
}

/** Fetches a single schedule by `_id`. Returns `null` if not found. */
export async function getScheduleById(id: string | ObjectId): Promise<Schedule | null> {
  const schedules = await schedulesCollection();
  return schedules.findOne({ _id: toObjectId(id) });
}

/** Lists every enabled schedule whose `nextRunAt` is at/before `now` — the cron's due set. */
export async function listDueSchedules(now: Date = new Date()): Promise<Schedule[]> {
  const schedules = await schedulesCollection();
  return schedules.find({ enabled: true, nextRunAt: { $lte: now } }).toArray();
}

export type UpdateScheduleInput = Partial<{
  topic: string;
  cadence: Cadence;
  enabled: boolean;
  nextRunAt: Date;
}>;

/** Patches a schedule's editable fields. Returns the updated doc, or `null` if not found. */
export async function updateSchedule(
  id: string | ObjectId,
  patch: UpdateScheduleInput
): Promise<Schedule | null> {
  const schedules = await schedulesCollection();
  const set: Record<string, unknown> = { ...patch, updatedAt: new Date() };
  const result = await schedules.findOneAndUpdate(
    { _id: toObjectId(id) },
    { $set: set },
    { returnDocument: "after" }
  );
  return result ?? null;
}

/** Deletes a schedule. Returns `true` if a document was actually removed. */
export async function deleteSchedule(id: string | ObjectId): Promise<boolean> {
  const schedules = await schedulesCollection();
  const result = await schedules.deleteOne({ _id: toObjectId(id) });
  return result.deletedCount > 0;
}

/**
 * Records the outcome of a run launched by this schedule (cron-driven or
 * run-now) and advances `nextRunAt` by one cadence period from `at` (kept
 * simple per the BRD — a fixed cadence-length step from the moment the run
 * was launched, not a calendar-aligned slot).
 */
export async function recordScheduleRun(
  id: string | ObjectId,
  result: ScheduleLastResult,
  cadence: Cadence
): Promise<void> {
  const schedules = await schedulesCollection();
  await schedules.updateOne(
    { _id: toObjectId(id) },
    {
      $set: {
        lastResult: result,
        nextRunAt: computeNextRunAt(cadence, result.at),
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Records a run's outcome WITHOUT advancing `nextRunAt` — used by the
 * manual "run now" API action (an extra, out-of-band run shouldn't consume
 * or shift the schedule's next normal cadence tick).
 */
export async function setLastResult(
  id: string | ObjectId,
  result: ScheduleLastResult
): Promise<void> {
  const schedules = await schedulesCollection();
  await schedules.updateOne(
    { _id: toObjectId(id) },
    { $set: { lastResult: result, updatedAt: new Date() } }
  );
}
