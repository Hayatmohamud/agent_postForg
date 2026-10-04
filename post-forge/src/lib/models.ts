/**
 * Gemini model factory (all AI text calls, all tiers).
 *
 * Every text model call goes through Gemini's OpenAI-compatible
 * chat-completions endpoint via AgentKit's `openai()` adapter pointed at
 * Google's base URL — verified against ai.google.dev/gemini-api/docs/openai
 * (2026-09, live fetch): base URL `https://generativelanguage.googleapis.com/v1beta/openai/`,
 * bearer-token auth, `/chat/completions` path. This keeps the exact same
 * AgentKit integration shape the OpenRouter setup used; only the
 * baseUrl/apiKey/model values changed.
 *
 * ---------------------------------------------------------------------------
 * REQUIRED WORKAROUND — Gemini 3's mandatory "thought signature" round-trip
 * ---------------------------------------------------------------------------
 * Discovered live while migrating (2026-09): every research/verify agent
 * that uses tools (`web_search`/`fetch_url`) hung indefinitely on its second
 * turn. Root cause, confirmed by intercepting the raw HTTP traffic and
 * reproducing it with bare `curl`:
 *
 * Gemini 3 models are "thinking" models. When a response includes a tool
 * call, Gemini's OpenAI-compat layer attaches an encrypted
 * `choices[].message.tool_calls[].extra_content.google.thought_signature` —
 * Google's own docs call this a required part of the function-call contract,
 * not an optional extra (ai.google.dev/gemini-api/docs/thought-signatures).
 * The *next* request in the conversation (the one carrying the tool's
 * result back to the model) MUST echo that exact signature back on the
 * reconstructed assistant `tool_calls` entry, or Gemini rejects the whole
 * request with `400 INVALID_ARGUMENT: Function call is missing a
 * thought_signature in functionCall parts`.
 *
 * AgentKit's `openai()` adapter is written against the standard OpenAI
 * message schema, which has no field for a vendor extension like
 * `extra_content` — it silently drops the signature when parsing Gemini's
 * response into its own internal `Message` type, and so has nothing to
 * replay on the follow-up request. This isn't fixable via a request
 * parameter: `reasoning_effort: "none"` was tested live and Gemini still
 * requires (and returns) a signature on every tool call regardless.
 *
 * The fix below patches `globalThis.fetch` (once, idempotently) to sit
 * between AgentKit and Gemini: it captures each tool call's signature from
 * responses (keyed by the model-generated `tool_call.id`, which AgentKit
 * does preserve verbatim across the conversation) and re-injects it into
 * any outgoing request's matching `tool_calls[].extra_content` before
 * AgentKit's request ever reaches Gemini. Verified live end-to-end (a
 * manually-replayed signature turns the same 400 into a clean `200`/`stop`
 * with a real synthesized answer) — this is not a client library affected
 * by the workaround (`@inngest/agent-kit@0.13.2`'s HTTP layer is
 * unconditionally `fetch`, not a wrapped client instance).
 */

import { openai } from "@inngest/agent-kit";
import { env, requireGeminiKey } from "./env";

const GEMINI_OPENAI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

// Verified against this account's actual available models + quota (2026-09,
// live check via GET /v1beta/models + a real chat-completions call): the
// account has ZERO free-tier quota for any "pro"-tier Gemini model
// (gemini-3.1-pro / gemini-pro-latest / gemini-2.5-pro all 404 or 429 with
// `limit: 0`), so the smart tier uses the strongest model that's actually
// callable on this key rather than a pro-tier id that would fail every run.
const DEFAULT_SMART_MODEL = "gemini-3.5-flash";
const DEFAULT_CHEAP_MODEL = "gemini-3.1-flash-lite";

type OpenAiToolCall = {
  id?: string;
  extra_content?: { google?: { thought_signature?: string } };
};
type OpenAiMessage = { role?: string; tool_calls?: OpenAiToolCall[] };
type OpenAiChatCompletionsBody = { messages?: OpenAiMessage[] };
type OpenAiChatCompletionsResponse = {
  choices?: { message?: OpenAiMessage }[];
};

/** tool_call.id -> the thought_signature Gemini attached to that call. */
const thoughtSignatureCache = new Map<string, string>();

function isGeminiUrl(input: RequestInfo | URL): boolean {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return url.includes("generativelanguage.googleapis.com");
}

/** Injects any cached signature into this outgoing request's tool_calls, mutating `body` in place. */
function injectCachedSignatures(body: OpenAiChatCompletionsBody): void {
  for (const message of body.messages ?? []) {
    if (message.role !== "assistant") continue;
    for (const toolCall of message.tool_calls ?? []) {
      if (!toolCall.id || toolCall.extra_content?.google?.thought_signature) continue;
      const cached = thoughtSignatureCache.get(toolCall.id);
      if (!cached) continue;
      toolCall.extra_content = {
        ...toolCall.extra_content,
        google: { ...toolCall.extra_content?.google, thought_signature: cached },
      };
    }
  }
}

/** Captures every tool call's signature from a response for later replay. */
function captureSignatures(response: OpenAiChatCompletionsResponse): void {
  for (const choice of response.choices ?? []) {
    for (const toolCall of choice.message?.tool_calls ?? []) {
      const signature = toolCall.extra_content?.google?.thought_signature;
      if (toolCall.id && signature) {
        thoughtSignatureCache.set(toolCall.id, signature);
      }
    }
  }
}

/** Idempotently wraps `globalThis.fetch` with the thought-signature round-trip fix (see file doc comment). */
function patchGeminiThoughtSignatures(): void {
  const flagged = globalThis as unknown as { __geminiThoughtSigPatched?: boolean };
  if (flagged.__geminiThoughtSigPatched) return;
  flagged.__geminiThoughtSigPatched = true;

  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isGeminiUrl(input) || typeof init?.body !== "string") {
      return realFetch(input, init);
    }

    let body: OpenAiChatCompletionsBody;
    try {
      body = JSON.parse(init.body);
    } catch {
      return realFetch(input, init);
    }
    injectCachedSignatures(body);
    const patchedInit: RequestInit = { ...init, body: JSON.stringify(body) };

    const response = await realFetch(input, patchedInit);
    response
      .clone()
      .json()
      .then((json: OpenAiChatCompletionsResponse) => captureSignatures(json))
      .catch(() => {
        // Non-JSON or error response — nothing to capture, and this must
        // never affect the real response returned to the caller.
      });
    return response;
  };
}

patchGeminiThoughtSignatures();

export type ModelOverrides = { model?: string };

/**
 * The "smart" tier: orchestration/quality agents (e.g. verify, editor).
 * Resolves `overrides.model` -> `LLM_MODEL_SMART` -> the built-in default.
 */
export function smartModel(overrides?: ModelOverrides) {
  const model = overrides?.model ?? env("LLM_MODEL_SMART") ?? DEFAULT_SMART_MODEL;
  return openai({
    model,
    apiKey: requireGeminiKey(),
    baseUrl: GEMINI_OPENAI_BASE_URL,
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
    apiKey: requireGeminiKey(),
    baseUrl: GEMINI_OPENAI_BASE_URL,
  });
}
