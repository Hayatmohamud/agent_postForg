/**
 * Research agent (T04) — CHEAP tier.
 *
 * Uses `web_search`/`fetch_url` to find sourced claims about the run's
 * topic and writes `state.data.research: Finding[]`. Grounds the memory/
 * dedupe requirement (BRD 4.4) by listing recently-covered topics in its
 * system prompt so the model can note overlap (enforcement stays T19's job).
 */

import { createAgent, type Agent } from "@inngest/agent-kit";
import { z } from "zod";
import { webSearchTool } from "./tools/web_search";
import { fetchUrlTool } from "./tools/fetch_url";
import { listPosts } from "@/lib/posts-repo";
import type { Finding, NetworkState } from "@/lib/state";
import {
  MAX_STAGE_ATTEMPTS,
  bumpStageAttempts,
  lastAssistantText,
  stripUnknownToolCalls,
  tryParseJson,
  type TextModel,
} from "./shared";

const MAX_FINDINGS = 8;
const MAX_MEMORY_TOPICS = 10;

const findingsSchema = z
  .array(
    z.object({
      claim: z.string().min(1),
      source: z.object({ title: z.string(), url: z.string() }),
    })
  )
  .min(1)
  .max(MAX_FINDINGS);

/** Best-effort recent-topics note for duplicate-topic awareness (BRD 4.4). */
async function memoryNote(): Promise<string> {
  try {
    const { items } = await listPosts({ pageSize: MAX_MEMORY_TOPICS });
    if (items.length === 0) return "";
    const topics = items.map((p) => `- ${p.topic}`).join("\n");
    return `\n\nRecently covered topics in this system (flag it if the current topic substantially overlaps, but still research it):\n${topics}`;
  } catch {
    // Memory is best-effort context; a missing/unreachable DB must not
    // block research from proceeding.
    return "";
  }
}

export function createResearchAgent(model: TextModel): Agent<NetworkState> {
  return createAgent<NetworkState>({
    name: "research",
    description:
      "Searches the web for the topic and extracts up to 8 concrete, sourced claims.",
    model,
    tools: [webSearchTool, fetchUrlTool],
    system: async () => {
      const note = await memoryNote();
      return `You are the Research agent in an autonomous content-generation pipeline.

Given a topic (the user message), use the web_search and fetch_url tools to find up to ${MAX_FINDINGS} concrete, factual claims about it, each traceable to a real source you found via the tools.

When you are done researching (you do not need to use every tool call available), respond with ONLY a JSON array, no prose, no markdown code fences, shaped exactly as:
[{"claim": "...", "source": {"title": "...", "url": "..."}}]

Rules:
- Every "url" must be a real URL returned by a tool call you made this conversation.
- Do not invent sources or claims.
- Prefer specific, checkable facts over vague statements.${note}`;
    },
    lifecycle: {
      onResponse: ({ agent, result }) => stripUnknownToolCalls(agent, result),
      onFinish: ({ network, result }) => {
        if (!network) return result;
        const state = network.state.data;
        const attempt = bumpStageAttempts(network.state, "research");
        const text = lastAssistantText(result);
        const parsed = tryParseJson<unknown>(text);
        const valid = findingsSchema.safeParse(parsed);

        if (valid.success) {
          state.research = valid.data.map((f) => ({ ...f, verified: false }));
          return result;
        }

        if (attempt >= MAX_STAGE_ATTEMPTS) {
          // Graceful degradation: the model never produced parseable JSON
          // after several attempts. Fall back to the raw web_search results
          // gathered across this run's tool calls rather than spinning the
          // router toward the network's hard iteration cap.
          state.research = fallbackFindingsFromToolCalls(result);
        }
        return result;
      },
    },
  });
}

function fallbackFindingsFromToolCalls(result: {
  toolCalls: { tool: { name: string }; content: unknown }[];
}): Finding[] {
  const out: Finding[] = [];
  for (const call of result.toolCalls) {
    if (call.tool.name !== "web_search") continue;
    const data = (call.content as { data?: unknown } | undefined)?.data;
    if (!Array.isArray(data)) continue;
    for (const item of data) {
      if (
        item &&
        typeof item === "object" &&
        "title" in item &&
        "url" in item &&
        "snippet" in item
      ) {
        const r = item as { title: string; url: string; snippet: string };
        if (!r.url) continue;
        out.push({
          claim: r.snippet || r.title || "Unverified finding",
          source: { title: r.title || r.url, url: r.url },
          verified: false,
        });
      }
      if (out.length >= MAX_FINDINGS) break;
    }
    if (out.length >= MAX_FINDINGS) break;
  }
  if (out.length === 0) {
    out.push({
      claim: "Research agent could not produce verifiable findings after multiple attempts.",
      source: { title: "n/a", url: "" },
      verified: false,
    });
  }
  return out;
}
