/**
 * Writer agent (T04) — CHEAP tier (cheapest model for post writing, per the
 * T04 orchestrator amendment). No tools — composes `state.data.draft`
 * grounded strictly in `state.data.verifiedFindings`, honoring
 * `options.tone`/`options.length`.
 */

import { createAgent, type Agent } from "@inngest/agent-kit";
import type { NetworkState } from "@/lib/state";
import {
  MAX_STAGE_ATTEMPTS,
  bumpStageAttempts,
  lastAssistantText,
  stripUnknownToolCalls,
  type TextModel,
} from "./shared";

const LENGTH_GUIDANCE: Record<string, string> = {
  short: "About 300-450 words.",
  medium: "About 600-900 words.",
  long: "About 1000-1400 words.",
};

export function createWriterAgent(model: TextModel): Agent<NetworkState> {
  return createAgent<NetworkState>({
    name: "writer",
    description:
      "Composes an engaging draft post grounded strictly in verified findings.",
    model,
    system: ({ network }) => {
      const findings = network?.state.data.verifiedFindings ?? [];
      const options = network?.state.data.options ?? {};
      const tone = options.tone ?? "informative and engaging";
      const length = LENGTH_GUIDANCE[options.length ?? "medium"] ?? LENGTH_GUIDANCE.medium;

      return `You are the Writer agent in an autonomous content-generation pipeline.

Write a full, substantial blog post about the given topic (the user message), using ONLY the following verified findings as your factual basis — do not introduce new facts, numbers, or claims that aren't supported by them:
${JSON.stringify(findings, null, 2)}

Tone: ${tone}
Length: ${length}

Don't just restate the findings as a terse list. For each one, explain it in your own words, add context on why it matters, connect it to the others, and unpack its implications for the reader — depth and elaboration, not new facts. Structure it like a real article: a strong opening hook, well-developed body paragraphs, and a closing thought. Respond with ONLY the post body text (plain prose, no JSON, no markdown headers, no code fences). Every factual claim you make must still trace back to one of the findings above.`;
    },
    lifecycle: {
      onResponse: ({ agent, result }) => stripUnknownToolCalls(agent, result),
      onFinish: ({ network, result }) => {
        if (!network) return result;
        const state = network.state.data;
        const attempt = bumpStageAttempts(network.state, "writer");
        const text = lastAssistantText(result).trim();

        if (text.length > 0) {
          state.draft = text;
          return result;
        }

        if (attempt >= MAX_STAGE_ATTEMPTS) {
          // Graceful degradation: synthesize a minimal draft directly from
          // verified findings rather than leaving `draft` unset forever.
          const findings = state.verifiedFindings ?? [];
          state.draft =
            findings.length > 0
              ? findings.map((f) => f.claim).join(" ")
              : "No verified findings were available to write this post.";
        }
        return result;
      },
    },
  });
}
