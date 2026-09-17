/**
 * Shared DTO types for the API surface (T06): the single source of truth
 * for every response shape UI tasks (T10-T15) build against.
 *
 * Rules locked here, deliberately, so a later shape change doesn't ripple
 * through 7 parallel UI tasks:
 * - Every date in a DTO is an ISO-8601 string (`Date.toISOString()`), never
 *   a `Date` object — Next.js route handlers serialize to JSON anyway, so
 *   this just makes the *type* honest about what callers actually receive.
 * - `imageModel` (not `imageProvider`) is the field name throughout, per
 *   `GenerationOptions` in `src/lib/state.ts` (T02) which the rest of the
 *   codebase (T03/T04/T05) already standardized on.
 * - Every error response uses the same `{ error: { message, code? } }`
 *   shape (`ErrorResponse`), regardless of route or HTTP status.
 */

import type {
  Finding,
  GenerationOptions,
  Post,
  PostStatus,
  Stage,
  StageState,
} from "./state";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Standard error-response body every route returns on failure. */
export type ErrorResponse = {
  error: {
    message: string;
    code?: string;
  };
};

// ---------------------------------------------------------------------------
// POST /api/generate
// ---------------------------------------------------------------------------

/** Request body for `POST /api/generate`. */
export type GenerateRequest = {
  topic: string;
  options?: GenerationOptions;
};

/** Response body for `POST /api/generate`. */
export type GenerateResponse = {
  id: string;
  runId: string;
};

/**
 * Response body when T19's rate-limit/dedupe guard blocks a
 * `POST /api/generate` request (HTTP 429). Deliberately just `ErrorResponse`
 * plus an optional `existingPostId` — not a separate shape — so callers
 * (T10's New Post UI) can always read `error.message` generically and only
 * branch on `existingPostId` to link to the pre-existing post when
 * `error.code === "deduped"`.
 */
export type GenerateBlockedResponse = ErrorResponse & {
  existingPostId?: string;
};

// ---------------------------------------------------------------------------
// GET /api/posts (list)
// ---------------------------------------------------------------------------

/** Per-stage progress, mirroring `StageState` but with ISO date strings. */
export type StageStateDTO = {
  state: StageState["state"];
  startedAt?: string;
  endedAt?: string;
  detail?: string;
};

/** One row in the posts list — a lightweight projection of `Post`. */
export type PostSummary = {
  id: string;
  topic: string;
  status: PostStatus;
  title?: string;
  posterImageId?: string;
  createdAt: string;
  updatedAt: string;
};

/** Response body for `GET /api/posts`. */
export type PostListResponse = {
  items: PostSummary[];
  page: number;
  pageSize: number;
  total: number;
};

// ---------------------------------------------------------------------------
// GET /api/posts/[id] (poll shape)
// ---------------------------------------------------------------------------

/** A single sub-progress entry, with an ISO date string. */
export type SubProgressEntryDTO = {
  stage: Stage;
  kind: string;
  data: unknown;
  at: string;
};

/**
 * The full poll shape returned by `GET /api/posts/[id]`. Always carries the
 * live `status`/`stages`/`subProgress`; the "full payload" fields
 * (`finalPost`, `sources`, `title`, `posterImageId`, `telemetry`) are present
 * throughout a run (empty/undefined until each stage lands) so pollers don't
 * need to branch on `status === "done"` to read them — they simply won't be
 * populated yet.
 */
export type PostDetail = {
  id: string;
  topic: string;
  status: PostStatus;
  stages: Record<Stage, StageStateDTO>;
  subProgress: SubProgressEntryDTO[];
  research: Finding[];
  verifiedFindings: Finding[];
  title?: string;
  draft?: string;
  finalPost?: string;
  sources: { title: string; url: string }[];
  posterImageId?: string;
  options: GenerationOptions;
  telemetry: {
    tokensByAgent: Record<string, number>;
    timingsByStage: Record<string, number>;
  };
  runId: string;
  createdAt: string;
  updatedAt: string;
  error?: { stage?: Stage; message: string };
};

// ---------------------------------------------------------------------------
// GET /api/stats
// ---------------------------------------------------------------------------

/** One point in a time-bucketed series (day granularity, ISO date string). */
export type TimeSeriesPoint = {
  date: string;
  value: number;
};

/** Response body for `GET /api/stats`. */
export type StatsResponse = {
  totals: {
    all: number;
    done: number;
    failed: number;
    inProgress: number;
  };
  avgGenerationTimeMs: number | null;
  avgStageTimingsMs: Record<Stage, number>;
  tokensByAgent: Record<string, number>;
  activityByDay: TimeSeriesPoint[];
};

// ---------------------------------------------------------------------------
// GET/PUT /api/settings
// ---------------------------------------------------------------------------

/** Generation defaults round-tripped by `GET`/`PUT /api/settings`. */
export type SettingsDTO = GenerationOptions;

// ---------------------------------------------------------------------------
// Serialization helpers (DB `Post` -> DTOs, ISO dates throughout)
// ---------------------------------------------------------------------------

function toIso(date: Date | undefined): string | undefined {
  return date ? date.toISOString() : undefined;
}

function stageToDTO(stage: StageState): StageStateDTO {
  return {
    state: stage.state,
    startedAt: toIso(stage.startedAt),
    endedAt: toIso(stage.endedAt),
    detail: stage.detail,
  };
}

/** Projects a full `Post` document into the lightweight `PostSummary` DTO. */
export function toPostSummary(post: Post): PostSummary {
  return {
    id: post._id.toString(),
    topic: post.topic,
    status: post.status,
    title: post.title,
    posterImageId: post.posterImageId,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

/** Projects a full `Post` document into the `PostDetail` poll-shape DTO. */
export function toPostDetail(post: Post): PostDetail {
  const stages = {} as Record<Stage, StageStateDTO>;
  for (const [stage, state] of Object.entries(post.stages) as [Stage, StageState][]) {
    stages[stage] = stageToDTO(state);
  }

  return {
    id: post._id.toString(),
    topic: post.topic,
    status: post.status,
    stages,
    subProgress: post.subProgress.map((entry) => ({
      stage: entry.stage,
      kind: entry.kind,
      data: entry.data,
      at: entry.at.toISOString(),
    })),
    research: post.research,
    verifiedFindings: post.verifiedFindings,
    title: post.title,
    draft: post.draft,
    finalPost: post.finalPost,
    sources: post.sources,
    posterImageId: post.posterImageId,
    options: post.options,
    telemetry: post.telemetry,
    runId: post.runId,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    error: post.error,
  };
}
