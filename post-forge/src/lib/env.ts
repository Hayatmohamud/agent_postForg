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
 * Amendment (T02, per CLAUDE.md's "Env contract" section): all AI calls —
 * text AND poster image — route through OpenRouter via a single
 * `OPENROUTER_API_KEY` (legacy alias `OPEN_ROUTER` also accepted). There are
 * no separate Gemini/OpenAI provider keys; model selection is via env-
 * overridable OpenRouter model ids (`LLM_MODEL_SMART`, `LLM_MODEL_CHEAP`,
 * `LLM_MODEL`, `IMAGE_MODEL`).
 */

/** All env vars PostForge knows about. Keep in sync with `.env.example`. */
export type EnvVarName =
  | "OPENROUTER_API_KEY"
  | "OPEN_ROUTER"
  | "LLM_MODEL"
  | "LLM_MODEL_SMART"
  | "LLM_MODEL_CHEAP"
  | "IMAGE_MODEL"
  | "SERPER_API_KEY"
  | "MONGODB_URI"
  | "INNGEST_EVENT_KEY"
  | "INNGEST_SIGNING_KEY"
  | "MAX_INFLIGHT_RUNS"
  | "DEDUPE_WINDOW_HOURS";

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

/**
 * Reads the single OpenRouter API key used for every AI call (text and
 * image), accepting the legacy `OPEN_ROUTER` alias. Throws a
 * `MissingEnvError` (named `OPENROUTER_API_KEY`) if neither is set.
 */
export function requireOpenRouterKey(): string {
  const value = env("OPENROUTER_API_KEY") ?? env("OPEN_ROUTER");
  if (value === undefined) {
    throw new MissingEnvError("OPENROUTER_API_KEY");
  }
  return value;
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
