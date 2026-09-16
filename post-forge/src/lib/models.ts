/**
 * OpenRouter model factory (all AI text calls, all tiers).
 *
 * Per the T02 orchestrator amendment, every text model call goes through
 * OpenRouter's OpenAI-compatible chat-completions API via AgentKit's
 * `openai()` adapter pointed at OpenRouter's base URL. There is no direct
 * Google/Anthropic/OpenAI provider usage.
 */

import { openai } from "@inngest/agent-kit";
import { env, requireOpenRouterKey } from "./env";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const DEFAULT_SMART_MODEL = "openai/gpt-5.5";
const DEFAULT_CHEAP_MODEL = "google/gemini-2.5-flash-lite";

export type ModelOverrides = { model?: string };

/**
 * The "smart" tier: orchestration/quality agents (e.g. verify, editor).
 * Resolves `overrides.model` -> `LLM_MODEL_SMART` -> the built-in default.
 */
export function smartModel(overrides?: ModelOverrides) {
  const model = overrides?.model ?? env("LLM_MODEL_SMART") ?? DEFAULT_SMART_MODEL;
  return openai({
    model,
    apiKey: requireOpenRouterKey(),
    baseUrl: OPENROUTER_BASE_URL,
  });
}

/**
 * The "cheap" tier: post writing / light agents.
 * Resolves `overrides.model` -> `LLM_MODEL_CHEAP` -> the built-in default.
 */
export function cheapModel(overrides?: ModelOverrides) {
  const model = overrides?.model ?? env("LLM_MODEL_CHEAP") ?? DEFAULT_CHEAP_MODEL;
  return openai({
    model,
    apiKey: requireOpenRouterKey(),
    baseUrl: OPENROUTER_BASE_URL,
  });
}

/**
 * General fallback / alias for the SMART tier, kept for BRD compatibility.
 * Resolves `overrides.model` -> `LLM_MODEL` -> `LLM_MODEL_SMART` -> default.
 */
export function gpt5(overrides?: ModelOverrides) {
  const model =
    overrides?.model ?? env("LLM_MODEL") ?? env("LLM_MODEL_SMART") ?? DEFAULT_SMART_MODEL;
  return openai({
    model,
    apiKey: requireOpenRouterKey(),
    baseUrl: OPENROUTER_BASE_URL,
  });
}
