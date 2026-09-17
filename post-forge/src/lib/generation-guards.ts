/**
 * Pure decision logic for T19's rate-limit + dedupe guard on
 * `POST /api/generate` (BRD 4.1). Deliberately kept free of any DB/env
 * access so both checks are directly unit-testable with plain fixtures —
 * `src/app/api/generate/core.ts` is the only caller that fetches real data
 * (via `src/lib/posts-repo.ts`) and wires these decisions into an HTTP-ish
 * response.
 */

import type { PostStatus } from "./state";

/** A blocked/allowed decision from either guard check. */
export type GuardDecision =
  | { blocked: false }
  | {
      blocked: true;
      code: "rate_limited" | "deduped";
      message: string;
      existingPostId?: string;
    };

const ALLOWED: GuardDecision = { blocked: false };

/**
 * Normalizes a topic for near-duplicate matching: lowercase, trim, strip
 * punctuation, and collapse internal whitespace. Intentionally simple
 * (exact-ish matching) per the BRD's own open question about normalization
 * strategy — no fuzzy/semantic matching.
 */
export function normalizeTopic(topic: string): string {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

/** Statuses that make a post ineligible to be treated as "in flight" or a live dupe. */
const TERMINAL_STATUSES: readonly PostStatus[] = ["done", "failed"];

/** True for any status other than `done`/`failed` — i.e. still running. */
export function isInFlightStatus(status: PostStatus): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

/**
 * Concurrency/quota cap: blocks a new run if `inFlightCount` (posts with a
 * non-terminal status) is already at or above `maxInflightRuns`.
 */
export function checkConcurrencyCap(
  inFlightCount: number,
  maxInflightRuns: number
): GuardDecision {
  if (inFlightCount >= maxInflightRuns) {
    return {
      blocked: true,
      code: "rate_limited",
      message: `Too many generations are already in progress (limit ${maxInflightRuns}). Wait for one to finish before starting another.`,
    };
  }
  return ALLOWED;
}

/** Lightweight projection of a post used only for the dedupe comparison. */
export type DedupeCandidate = {
  id: string;
  topic: string;
  status: PostStatus;
  createdAt: Date;
};

/**
 * Dedupe check: blocks a new run if `candidates` (expected to already be
 * pre-filtered to roughly the right time range by the caller) contains a
 * `done` or in-flight post whose normalized topic matches `topic`, created
 * within `windowHours` of `now`. A `failed` post never counts as a dupe —
 * the user should be able to retry a topic that previously failed.
 */
export function checkDedupe(
  topic: string,
  candidates: DedupeCandidate[],
  windowHours: number,
  now: Date = new Date()
): GuardDecision {
  const normalized = normalizeTopic(topic);
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

  const match = candidates.find((candidate) => {
    if (candidate.status === "failed") return false;
    if (candidate.createdAt < windowStart) return false;
    return normalizeTopic(candidate.topic) === normalized;
  });

  if (!match) return ALLOWED;

  return {
    blocked: true,
    code: "deduped",
    message:
      match.status === "done"
        ? "A post for this topic already exists."
        : "A generation run for this topic is already in progress.",
    existingPostId: match.id,
  };
}
