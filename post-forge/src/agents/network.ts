/**
 * The PostForge agent network (T04): six agents wired together behind a
 * deterministic, state-driven code router (no LLM routing). Walks
 * Research -> Verify -> Write -> Edit -> Illustrate -> Publish by
 * inspecting `network.state.data` and stops once `published === true`.
 *
 * `buildNetwork(options)` is a factory rather than a module-level network
 * instance: AgentKit binds a model instance to each agent at construction
 * time, so honoring a per-run `options.model` override (BRD 0 amendment)
 * means building fresh model instances + agents on every call rather than
 * caching a single network (see tasks/REPORTS.md's own worked example of
 * this exact pitfall).
 */

import { createNetwork, createState, type Agent, type Network } from "@inngest/agent-kit";
import { cheapModel, smartModel } from "@/lib/models";
import type { GenerationOptions, NetworkState } from "@/lib/state";
import { createResearchAgent } from "./research";
import { createVerifyAgent } from "./verify";
import { createWriterAgent } from "./writer";
import { createEditorAgent } from "./editor";
import { createIllustratorAgent } from "./illustrator";
import { createPublisherAgent } from "./publisher";
import { MAX_ROUTER_ITERATIONS } from "./shared";

export type PipelineAgents = {
  research: Agent<NetworkState>;
  verify: Agent<NetworkState>;
  writer: Agent<NetworkState>;
  editor: Agent<NetworkState>;
  illustrator: Agent<NetworkState>;
  publisher: Agent<NetworkState>;
};

/** True when a Finding[] state key is unset or empty (treated the same). */
function isEmpty(list: unknown[] | undefined): boolean {
  return !list || list.length === 0;
}

/**
 * The deterministic router (BRD 4.2): a pure if-ladder over
 * `network.state.data`, exported standalone so it can be unit-tested with
 * hand-built partial states and no real model/agent instances (the BRD's
 * own required verification path, and the only one available without
 * OPENROUTER_API_KEY/SERPER_API_KEY/MONGODB_URI in this environment).
 */
export function routeNext(
  state: NetworkState,
  agents: PipelineAgents
): Agent<NetworkState> | undefined {
  if (isEmpty(state.research)) return agents.research;
  if (isEmpty(state.verifiedFindings)) return agents.verify;
  if (!state.draft) return agents.writer;
  if (!state.finalPost) return agents.editor;
  if (!state.posterImageId) return agents.illustrator;
  if (!state.published) return agents.publisher;
  return undefined;
}

export type BuildNetworkOptions = {
  /** The durable run id, mirrored into `state.data.runId` (BRD 6). */
  runId: string;
  /** Per-run generation options (model override, tone, length, image model). */
  options?: GenerationOptions;
};

/**
 * Builds a fresh six-agent network + deterministic router for one run.
 * `options.model` (if set) overrides the text model tier defaults across
 * every text agent, per the BRD 0 amendment; `smartModel`/`cheapModel`
 * fall back to their own env-configured defaults otherwise.
 */
export function buildNetwork(build: BuildNetworkOptions): Network<NetworkState> {
  const modelOverride = { model: build.options?.model };
  const smart = smartModel(modelOverride);
  const cheap = cheapModel(modelOverride);

  const agents: PipelineAgents = {
    research: createResearchAgent(cheap),
    verify: createVerifyAgent(smart),
    writer: createWriterAgent(cheap),
    editor: createEditorAgent(smart),
    illustrator: createIllustratorAgent(cheap),
    publisher: createPublisherAgent(cheap),
  };

  return createNetwork<NetworkState>({
    name: "postforge-pipeline",
    description:
      "Research -> Verify -> Write -> Edit -> Illustrate -> Publish, deterministically routed.",
    agents: [
      agents.research,
      agents.verify,
      agents.writer,
      agents.editor,
      agents.illustrator,
      agents.publisher,
    ],
    defaultState: createState<NetworkState>({
      runId: build.runId,
      options: build.options ?? {},
    }),
    router: ({ network }) => routeNext(network.state.data, agents),
    // Safety bound on total router iterations across the whole run (BRD 4.5).
    maxIter: MAX_ROUTER_ITERATIONS,
  });
}
