/**
 * Publisher agent (T04) — CHEAP tier (trivial persistence). Tool:
 * `save_post`, which writes `state.data.published` + `state.data.postId`
 * itself (it mutates `network.state.data` directly — see
 * tools/save_post.ts).
 *
 * Graceful degradation: if the model never successfully calls the tool
 * after `MAX_STAGE_ATTEMPTS`, the agent invokes the tool's handler directly
 * with deterministically-derived args (topic recovered from the run's own
 * prompt, since `topic` isn't part of the `NetworkState` contract; title/
 * finalPost/sources from state), so the run still terminates.
 */

import { createAgent, type Agent } from "@inngest/agent-kit";
import { savePostTool } from "./tools/save_post";
import type { NetworkState } from "@/lib/state";
import {
  MAX_STAGE_ATTEMPTS,
  bumpStageAttempts,
  dedupeSources,
  extractTopicFromPrompt,
  stripUnknownToolCalls,
  type TextModel,
} from "./shared";

export function createPublisherAgent(model: TextModel): Agent<NetworkState> {
  return createAgent<NetworkState>({
    name: "publisher",
    description: "Persists the finished post as the terminal pipeline step.",
    model,
    tools: [savePostTool],
    system: ({ network }) => {
      const state = network?.state.data;
      const sources = dedupeSources(state?.verifiedFindings ?? []);
      return `You are the Publisher agent, the final step in an autonomous content-generation pipeline.

Title: "${state?.title ?? ""}"
Final post:
"""
${state?.finalPost ?? ""}
"""

Sources to cite (already deduped):
${JSON.stringify(sources, null, 2)}

Call the save_post tool exactly once with:
- topic: the original topic from the user's message this conversation
- title: the title above
- finalPost: the final post above
- sources: the sources above`;
    },
    lifecycle: {
      onResponse: ({ agent, result }) => stripUnknownToolCalls(agent, result),
      onFinish: async ({ agent, network, result }) => {
        if (!network) return result;
        const state = network.state.data;
        const attempt = bumpStageAttempts(network.state, "publish");

        if (state.published) {
          return result;
        }

        if (attempt >= MAX_STAGE_ATTEMPTS) {
          // Graceful degradation: the model never successfully called
          // save_post. Persist deterministically so the run still
          // terminates with published:true rather than spinning forever.
          const topic = extractTopicFromPrompt(result) ?? state.title ?? "Untitled topic";
          const sources = dedupeSources(state.verifiedFindings ?? []);
          try {
            await savePostTool.handler(
              {
                topic,
                title: state.title,
                finalPost: state.finalPost,
                sources,
              },
              { agent, network, step: undefined }
            );
          } catch {
            // Leave published unset; the router will keep this stage
            // pending, bounded by the network's own maxIter safety cap.
          }
        }
        return result;
      },
    },
  });
}
