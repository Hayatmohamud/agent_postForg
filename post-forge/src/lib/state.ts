/**
 * Shared runtime types for PostForge: the canonical `Post` document shape
 * persisted to MongoDB, plus the AgentKit network state shape that mirrors
 * it during a run. Every backend task (tools, agents, API routes, UI,
 * analytics) imports these types rather than redefining them.
 */

import type { ObjectId } from "mongodb";

/** A single research claim with its source and verification status. */
export type Finding = {
  claim: string;
  source: { title: string; url: string };
  verified: boolean;
};

/** Overall lifecycle status of a post generation run. */
export type PostStatus =
  | "researching"
  | "verifying"
  | "writing"
  | "editing"
  | "illustrating"
  | "publishing"
  | "done"
  | "failed";

/** The six pipeline stages, in order. */
export type Stage =
  | "research"
  | "verify"
  | "write"
  | "edit"
  | "illustrate"
  | "publish";

export const STAGES: readonly Stage[] = [
  "research",
  "verify",
  "write",
  "edit",
  "illustrate",
  "publish",
];

/** Per-stage progress + timestamps, tracked independently per stage. */
export type StageState = {
  state: "queued" | "active" | "done" | "failed";
  startedAt?: Date;
  endedAt?: Date;
  detail?: string;
};

/** Per-run generation options; every field is an optional override. */
export type GenerationOptions = {
  /** Text model override (an OpenRouter model id). */
  model?: string;
  /** Poster image model override (an OpenRouter model id). */
  imageModel?: string;
  tone?: string;
  length?: "short" | "medium" | "long";
};

/** A single sub-progress event appended as a stage does incremental work. */
export type SubProgressEntry = {
  stage: Stage;
  kind: string;
  data: unknown;
  at: Date;
};

/** The canonical, persisted `posts` collection document shape. */
export type Post = {
  _id: ObjectId;
  topic: string;
  status: PostStatus;
  stages: Record<Stage, StageState>;
  subProgress: SubProgressEntry[];
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
  createdAt: Date;
  updatedAt: Date;
  error?: { stage?: Stage; message: string };
};

/**
 * The AgentKit network state shape (`network.state.data`) mirroring the
 * pipeline keys the deterministic router inspects to decide the next agent.
 */
export type NetworkState = {
  research?: Finding[];
  verifiedFindings?: Finding[];
  draft?: string;
  finalPost?: string;
  title?: string;
  posterImageId?: string;
  published?: boolean;
  postId?: string;
  runId: string;
  options: GenerationOptions;
};

/** Builds a fresh `stages` record with every stage `queued`. */
export function initialStages(): Record<Stage, StageState> {
  return {
    research: { state: "queued" },
    verify: { state: "queued" },
    write: { state: "queued" },
    edit: { state: "queued" },
    illustrate: { state: "queued" },
    publish: { state: "queued" },
  };
}
