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
  | "INNGEST_SIGNING_KEY";

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
