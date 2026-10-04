/**
 * Centralized, typed env/secrets contract for PostForge.
 *
 * - Optional vars are read lazily via `env()` and never throw.
 * - Required vars must be read via `requireEnv()`, which throws a clearly
 *   named `MissingEnvError` naming the missing key. This intentionally does
 *   NOT run at import time — callers request a var only when they actually
 *   need it (e.g. inside a route handler or an Inngest step), so importing
 *   this module never crashes the app just because an optional feature's
 *   key isn't configured yet.
 *
 * Amendment (post-T16): text AI (research/verify/write/edit) goes through
 * Google's Gemini API on `GEMINI_API_KEY`, via Gemini's OpenAI-compatible
 * chat-completions endpoint (`src/lib/models.ts`) so the existing AgentKit
 * `openai()` adapter keeps working unchanged. `LLM_MODEL_SMART`/
 * `LLM_MODEL_CHEAP` hold Gemini model ids (e.g. `gemini-3.5-flash`), not
 * OpenRouter ids.
 *
 * Further amendment (same day): poster image generation uses **Replicate**
 * (`REPLICATE_API_KEY`, `src/lib/image.ts`), a separate credential from
 * Gemini — not Gemini's own image models. Discovered live: this project's
 * `GEMINI_API_KEY` has zero free-tier quota for every Gemini image model
 * tested (`gemini-2.5-flash-image` and siblings all 429 `limit: 0`), a
 * Google Cloud billing restriction, so image generation was moved back to
 * Replicate (which the user already holds a working key for) while text
 * generation stays on Gemini. `IMAGE_MODEL` holds a **Replicate** model id
 * (`owner/name`, e.g. default `black-forest-labs/flux-schnell`), not a
 * Gemini one.
 */

/** All env vars PostForge knows about. Keep in sync with `.env.example`. */
export type EnvVarName =
  | "GEMINI_API_KEY"
  | "LLM_MODEL_SMART"
  | "LLM_MODEL_CHEAP"
  | "IMAGE_MODEL"
  | "REPLICATE_API_KEY"
  | "SERPER_API_KEY"
  | "MONGODB_URI"
  | "INNGEST_EVENT_KEY"
  | "INNGEST_SIGNING_KEY"
  | "MAX_INFLIGHT_RUNS"
  | "DEDUPE_WINDOW_HOURS"
  | "RESEND_API_KEY"
  | "RESEND_FROM_EMAIL";

export class MissingEnvError extends Error {
  constructor(name: EnvVarName) {
    super(`MissingEnvError: ${name} is not set`);
    this.name = "MissingEnvError";
  }
}

/** Reads an env var, returning `undefined` if unset. Never throws. */
export function env(name: EnvVarName): string | undefined {
  const value = process.env[name];
  return value === "" ? undefined : value;
}

/**
 * Reads a required env var, throwing a clear, named `MissingEnvError`
 * if it is missing or empty.
 */
export function requireEnv(name: EnvVarName): string {
  const value = env(name);
  if (value === undefined) {
    throw new MissingEnvError(name);
  }
  return value;
}

/** Reads the Gemini API key used for text generation (research/verify/write/edit). */
export function requireGeminiKey(): string {
  return requireEnv("GEMINI_API_KEY");
}

/** Reads the Replicate API token used for poster image generation. */
export function requireReplicateKey(): string {
  return requireEnv("REPLICATE_API_KEY");
}

/** Reads the Resend API key used to send sign-up OTP verification emails. */
export function requireResendKey(): string {
  return requireEnv("RESEND_API_KEY");
}

/** The "from" address OTP emails are sent as. Defaults to Resend's sandbox sender. */
export function resendFromEmail(): string {
  return env("RESEND_FROM_EMAIL") ?? "onboarding@resend.dev";
}

// ---------------------------------------------------------------------------
// T19: rate-limit / dedupe guard thresholds — optional, defaulted, never
// throw (unlike `requireEnv`) since the guard should degrade to sane
// built-in defaults rather than break `POST /api/generate` if unconfigured.
// ---------------------------------------------------------------------------

const DEFAULT_MAX_INFLIGHT_RUNS = 3;
const DEFAULT_DEDUPE_WINDOW_HOURS = 24;

/** Parses a positive-integer-ish env var, falling back to `fallback` if unset/invalid. */
function positiveNumberOr(name: EnvVarName, fallback: number): number {
  const raw = env(name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Max number of posts allowed in a non-terminal (not `done`/`failed`) status
 * at once before `POST /api/generate` starts refusing new runs. Defaults to
 * {@link DEFAULT_MAX_INFLIGHT_RUNS}.
 */
export function maxInflightRuns(): number {
  return positiveNumberOr("MAX_INFLIGHT_RUNS", DEFAULT_MAX_INFLIGHT_RUNS);
}

/**
 * Lookback window (in hours) for the duplicate-topic dedupe check: a `done`
 * or in-flight post with the same normalized topic created within this many
 * hours blocks a new run. Defaults to {@link DEFAULT_DEDUPE_WINDOW_HOURS}.
 */
export function dedupeWindowHours(): number {
  return positiveNumberOr("DEDUPE_WINDOW_HOURS", DEFAULT_DEDUPE_WINDOW_HOURS);
}
