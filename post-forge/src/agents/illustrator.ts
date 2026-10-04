/**
 * Illustrator agent (T04) — CHEAP tier (authors only a short image prompt).
 * Tool: `generate_poster`, which writes `state.data.posterImageId` itself
 * (it mutates `network.state.data` directly — see tools/generate_poster.ts).
 *
 * Graceful degradation, two layers:
 * 1. If the model never successfully calls the tool after
 *    `MAX_STAGE_ATTEMPTS`, the agent invokes the tool's handler directly
 *    with a deterministic prompt derived from the final post, so a weak
 *    model skipping the tool call doesn't stall the pipeline forever.
 * 2. If that direct call *also* throws (the image provider itself is down
 *    or out of quota — a real, permanent failure, not a model-quality
 *    issue), `state.posterSkipped` is set so `routeNext` moves on to
 *    publish instead of retrying forever into the network's `maxIter`
 *    safety cap. The post still completes and publishes, just without a
 *    poster image (per explicit product decision — see CLAUDE.md).
 */

import { createAgent, type Agent } from "@inngest/agent-kit";
import { generatePosterTool } from "./tools/generate_poster";
import type { NetworkState } from "@/lib/state";
import {
  MAX_STAGE_ATTEMPTS,
  bumpStageAttempts,
  stripUnknownToolCalls,
  type TextModel,
} from "./shared";

export function createIllustratorAgent(model: TextModel): Agent<NetworkState> {
  const agentDef = createAgent<NetworkState>({
    name: "illustrator",
    description: "Crafts a short image prompt and generates the poster image.",
    model,
    tools: [generatePosterTool],
    system: ({ network }) => {
      const title = network?.state.data.title ?? "";
      const finalPost = network?.state.data.finalPost ?? "";
      return `You are the Illustrator agent in an autonomous content-generation pipeline.

Final post title: "${title}"
Final post:
"""
${finalPost}
"""

Write a short (1-2 sentence), vivid, concrete image prompt capturing the essence of this post, then call the generate_poster tool with that prompt as its "prompt" argument. Do not include any text overlay instructions.`;
    },
    lifecycle: {
      onResponse: ({ agent, result }) => stripUnknownToolCalls(agent, result),
      onFinish: async ({ agent, network, result }) => {
        if (!network) return result;
        const state = network.state.data;
        const attempt = bumpStageAttempts(network.state, "illustrate");

        if (state.posterImageId) {
          return result;
        }

        if (attempt >= MAX_STAGE_ATTEMPTS) {
          // Graceful degradation: the model never successfully called
          // generate_poster (missing call, or a hallucinated/malformed one
          // stripped by onResponse). Call the tool ourselves so the
          // pipeline can still terminate with a poster.
          const fallbackPrompt = buildFallbackPrompt(state.title, state.finalPost);
          try {
            await generatePosterTool.handler(
              { prompt: fallbackPrompt },
              { agent, network, step: undefined }
            );
          } catch {
            // The image provider itself failed (down/out of quota) rather
            // than the model just missing the tool call — this won't fix
            // itself on a retry, so skip illustration and let the run
            // finish and publish without a poster.
            state.posterSkipped = true;
          }
        }
        return result;
      },
    },
  });
  return agentDef;
}

function buildFallbackPrompt(title: string | undefined, finalPost: string | undefined): string {
  if (title) return `An editorial illustration for an article titled "${title}".`;
  if (finalPost) return `An editorial illustration representing: ${finalPost.slice(0, 200)}`;
  return "A generic editorial illustration for a blog post.";
}
