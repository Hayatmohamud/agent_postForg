/**
 * Verify agent (T04) — SMART tier (fact-checking needs the stronger model).
 *
 * Re-checks each `state.data.research` claim via `web_search` and writes
 * `state.data.verifiedFindings: Finding[]` with an honest `verified` flag,
 * dropping claims it cannot support at all.
 *
 * This is the pipeline's known failure point (tasks/README.md "Known
 * pitfalls"): a weak/overloaded model may never emit well-formed JSON. If
 * `MAX_STAGE_ATTEMPTS` is spent with nothing parseable, findings are passed
 * through unchanged, each flagged `verified: false`, rather than spinning
 * the router toward the network's hard iteration cap.
 */

import { createAgent, type Agent } from "@inngest/agent-kit";
import { z } from "zod";
import { webSearchTool } from "./tools/web_search";
import type { Finding, NetworkState } from "@/lib/state";
import {
  MAX_STAGE_ATTEMPTS,
  bumpStageAttempts,
  lastAssistantText,
  stripUnknownToolCalls,
  tryParseJson,
  type TextModel,
} from "./shared";

const verifiedFindingsSchema = z.array(
  z.object({
    claim: z.string().min(1),
    source: z.object({ title: z.string(), url: z.string() }),
    verified: z.boolean(),
  })
);

export function createVerifyAgent(model: TextModel): Agent<NetworkState> {
  return createAgent<NetworkState>({
    name: "verify",
    description:
      "Cross-checks each research claim via web_search and flags/drops unsupported ones.",
    model,
    tools: [webSearchTool],
    system: ({ network }) => {
      const research = network?.state.data.research ?? [];
      return `You are the Verify agent in an autonomous content-generation pipeline.

Here are the claims Research produced for this topic, as JSON:
${JSON.stringify(research, null, 2)}

Use the web_search tool to cross-check each claim against independent evidence. For any claim you cannot corroborate at all, either drop it from the output or keep it with "verified": false — never mark a claim "verified": true unless you found supporting evidence yourself in this conversation.

When done, respond with ONLY a JSON array, no prose, no markdown code fences, shaped exactly as:
[{"claim": "...", "source": {"title": "...", "url": "..."}, "verified": true}]`;
    },
    lifecycle: {
      onResponse: ({ agent, result }) => stripUnknownToolCalls(agent, result),
      onFinish: ({ network, result }) => {
        if (!network) return result;
        const state = network.state.data;
        const attempt = bumpStageAttempts(network.state, "verify");
        const text = lastAssistantText(result);
        const parsed = tryParseJson<unknown>(text);
        const valid = verifiedFindingsSchema.safeParse(parsed);

        if (valid.success && valid.data.length > 0) {
          state.verifiedFindings = valid.data;
          return result;
        }

        if (attempt >= MAX_STAGE_ATTEMPTS) {
          // Graceful degradation (the documented failure point): pass
          // research through, flagged verified:false, rather than hang.
          const research: Finding[] = state.research ?? [];
          state.verifiedFindings = research.map((f) => ({
            ...f,
            verified: false,
          }));
        }
        return result;
      },
    },
  });
}
