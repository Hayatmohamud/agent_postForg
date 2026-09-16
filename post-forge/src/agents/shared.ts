/**
 * Shared helpers for the six pipeline agents (T04).
 *
 * Centralizes three known-pitfall mitigations (see tasks/README.md "Known
 * pitfalls from a prior build") so every agent applies them uniformly:
 *
 * 1. `stripUnknownToolCalls` — AgentKit's `invokeTools` throws
 *    `Inference requested a non-existent tool` the instant a model
 *    hallucinates a tool call. `onResponse` fires before `invokeTools`, so
 *    we filter every `tool_call` message's `tools` array down to names this
 *    agent actually has bound, turning a crash into a silently-dropped call.
 * 2. `bumpStageAttempts`/`stageAttempts` — a per-run, per-stage attempt
 *    counter (keyed off the run's own `State` object via a `WeakMap`, so
 *    concurrent runs and repeated test-harness calls never share counters)
 *    used to force a best-effort fallback after `MAX_STAGE_ATTEMPTS` instead
 *    of letting a weak model spin the router toward its hard `maxIter` cap.
 * 3. `tryParseJson` — best-effort JSON extraction from a model's final text,
 *    tolerating prose wrapping, markdown code fences, etc.
 */

import type { Agent, AgentResult, Message, State } from "@inngest/agent-kit";
import type { Finding, NetworkState } from "@/lib/state";

/** Max attempts a single stage gets before we force a degraded fallback. */
export const MAX_STAGE_ATTEMPTS = 3;

/** Safety bound on total router iterations across a whole run (BRD 4.5). */
export const MAX_ROUTER_ITERATIONS = 24;

/** Cap on the number of distinct sources carried into the final post. */
export const MAX_SOURCES = 8;

/** The model adapter type accepted by `createAgent`'s `model` option. */
export type TextModel = NonNullable<Parameters<typeof import("@inngest/agent-kit").createAgent>[0]["model"]>;

/**
 * Filters out any tool call the agent doesn't actually have bound, so a
 * weak model's hallucinated tool name degrades to "the call did nothing"
 * instead of crashing `invokeTools`.
 */
export function stripUnknownToolCalls<T extends NetworkState>(
  agent: Agent<T>,
  result: AgentResult
): AgentResult {
  const known = new Set(agent.tools.keys());
  result.output = result.output.map((msg: Message) => {
    if (msg.type !== "tool_call") return msg;
    const tools = (msg.tools ?? []).filter((t) => known.has(t.name));
    return { ...msg, tools };
  });
  return result;
}

const stageAttemptsMap = new WeakMap<State<NetworkState>, Record<string, number>>();

/** Increments and returns the attempt count for `stage` on this run's state. */
export function bumpStageAttempts(state: State<NetworkState>, stage: string): number {
  const bucket = stageAttemptsMap.get(state) ?? {};
  const next = (bucket[stage] ?? 0) + 1;
  bucket[stage] = next;
  stageAttemptsMap.set(state, bucket);
  return next;
}

/** Reads the current attempt count for `stage` without incrementing it. */
export function stageAttempts(state: State<NetworkState>, stage: string): number {
  return stageAttemptsMap.get(state)?.[stage] ?? 0;
}

/** Extracts the last assistant text content from a finished AgentResult. */
export function lastAssistantText(result: AgentResult): string {
  for (let i = result.output.length - 1; i >= 0; i--) {
    const msg = result.output[i];
    if (msg.type === "text" && msg.role === "assistant") {
      return typeof msg.content === "string"
        ? msg.content
        : msg.content.map((c) => c.text).join("");
    }
  }
  return "";
}

/**
 * Extracts the run's original topic text from an AgentResult's `prompt`
 * (every agent's prompt is `[system, userMessage, ?assistant]`, and the
 * same original `network.run(topic)` input is threaded to every agent in
 * the network, per AgentKit's `execute()` loop) — used as a fallback so a
 * deterministic degrade path (e.g. publisher's direct `save_post` call)
 * doesn't need a `topic` field that isn't part of the `NetworkState`
 * contract.
 */
export function extractTopicFromPrompt(result: AgentResult): string | undefined {
  const userMsg = result.prompt?.find((m) => m.type === "text" && m.role === "user");
  if (!userMsg || userMsg.type !== "text") return undefined;
  return typeof userMsg.content === "string"
    ? userMsg.content
    : userMsg.content.map((c) => c.text).join("");
}

/**
 * Best-effort JSON parse: tries the raw trimmed string, then a fenced
 * ```json ... ``` block, then the widest bracket-delimited substring.
 * Weak/cheap models routinely wrap JSON in prose or markdown fences.
 */
export function tryParseJson<T>(text: string): T | null {
  const candidates = [text.trim()];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const firstBracket = text.search(/[[{]/);
  const lastBracket = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    candidates.push(text.slice(firstBracket, lastBracket + 1));
  }
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** Dedupes findings by source URL and caps the result at `MAX_SOURCES`. */
export function dedupeSources(findings: Finding[]): { title: string; url: string }[] {
  const seen = new Set<string>();
  const out: { title: string; url: string }[] = [];
  for (const f of findings) {
    const url = f.source?.url;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ title: f.source.title || url, url });
    if (out.length >= MAX_SOURCES) break;
  }
  return out;
}
