/**
 * Editor agent (T04) — SMART tier (final polish/quality). No tools —
 * polishes `state.data.draft` into `state.data.finalPost` + `state.data.title`,
 * ensuring every claim still traces to a verified source.
 */

import { createAgent, type Agent } from "@inngest/agent-kit";
import { z } from "zod";
import type { NetworkState } from "@/lib/state";
import {
  MAX_STAGE_ATTEMPTS,
  bumpStageAttempts,
  lastAssistantText,
  stripUnknownToolCalls,
  tryParseJson,
  type TextModel,
} from "./shared";

const editSchema = z.object({
  title: z.string().min(1),
  finalPost: z.string().min(1),
});

export function createEditorAgent(model: TextModel): Agent<NetworkState> {
  return createAgent<NetworkState>({
    name: "editor",
    description:
      "Polishes the draft into a final post with a title, verifying claims trace to sources.",
    model,
    system: ({ network }) => {
      const draft = network?.state.data.draft ?? "";
      const findings = network?.state.data.verifiedFindings ?? [];
      const options = network?.state.data.options ?? {};

      return `You are the Editor agent in an autonomous content-generation pipeline.

Draft post:
"""
${draft}
"""

Verified findings the draft must stay grounded in:
${JSON.stringify(findings, null, 2)}

Requested tone: ${options.tone ?? "informative and engaging"}
Requested length: ${options.length ?? "medium"}

Polish the draft into a final, publish-ready post: tighten prose, fix structure, and remove or rephrase any claim that isn't actually supported by the verified findings above. Write a short, compelling title.

Respond with ONLY a JSON object, no prose, no markdown code fences, shaped exactly as:
{"title": "...", "finalPost": "..."}`;
    },
    lifecycle: {
      onResponse: ({ agent, result }) => stripUnknownToolCalls(agent, result),
      onFinish: ({ network, result }) => {
        if (!network) return result;
        const state = network.state.data;
        const attempt = bumpStageAttempts(network.state, "editor");
        const text = lastAssistantText(result);
        const parsed = tryParseJson<unknown>(text);
        const valid = editSchema.safeParse(parsed);

        if (valid.success) {
          state.title = valid.data.title;
          state.finalPost = valid.data.finalPost;
          return result;
        }

        if (attempt >= MAX_STAGE_ATTEMPTS) {
          // Graceful degradation: fall back to the writer's draft verbatim
          // (and a best-effort title) rather than never terminating.
          const draft = state.draft ?? "";
          state.finalPost = draft.length > 0 ? draft : "This post could not be edited.";
          state.title = state.title ?? deriveFallbackTitle(draft);
        }
        return result;
      },
    },
  });
}

function deriveFallbackTitle(draft: string): string {
  const firstSentence = draft.split(/[.!?\n]/)[0]?.trim();
  if (firstSentence && firstSentence.length > 0 && firstSentence.length <= 80) {
    return firstSentence;
  }
  return "Untitled post";
}
