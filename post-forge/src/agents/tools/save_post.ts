/**
 * `save_post` AgentKit tool — persists the finished post as the terminal
 * pipeline step (the Publisher agent, T04).
 *
 * `runId` is deliberately NOT an LLM-supplied parameter: it is read from
 * `network.state.data.runId` (always present, minted by `POST /api/generate`
 * per the locked "doc ownership" decision), so idempotency doesn't depend
 * on a model faithfully echoing back an opaque id. This also upserts via
 * the repository (`upsertFinalPost`, keyed by `runId`) so re-running the
 * same run never creates a duplicate document.
 *
 * `strict: false` — the schema has optional fields, and OpenAI-compatible
 * strict function-calling requires every property to be `required` (see
 * tasks/README.md "Known pitfalls"); non-strict avoids spurious tool-call
 * rejections when a field is legitimately omitted (e.g. no sources found).
 */

import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { upsertFinalPost } from "@/lib/posts-repo";
import type { NetworkState } from "@/lib/state";

export class SavePostToolError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`SavePostToolError: ${message}`);
    this.name = "SavePostToolError";
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

const sourceSchema = z.object({
  title: z.string(),
  url: z.string(),
});

export const savePostTool = createTool({
  name: "save_post",
  description:
    "Persists the finished post as the final MongoDB document, idempotent per run. Marks the run as published/done.",
  parameters: z.object({
    topic: z.string(),
    title: z.string().optional(),
    finalPost: z.string().optional(),
    sources: z.array(sourceSchema).optional(),
  }),
  handler: async (
    { topic, title, finalPost, sources },
    { network }
  ): Promise<{ postId: string }> => {
    const state = network.state.data as NetworkState;
    const runId = state.runId;
    if (!runId) {
      throw new SavePostToolError("missing runId in network state");
    }

    let postId: string;
    try {
      const doc = await upsertFinalPost(runId, {
        topic,
        title: title ?? state.title,
        draft: state.draft,
        finalPost: finalPost ?? state.finalPost,
        research: state.research,
        verifiedFindings: state.verifiedFindings,
        sources: sources ?? [],
        posterImageId: state.posterImageId,
        options: state.options,
      });
      postId = doc._id.toString();
    } catch (err) {
      throw new SavePostToolError(
        `failed to persist post: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }

    state.postId = postId;
    state.published = true;
    return { postId };
  },
});

// `createTool`'s input type only accepts {name,description,parameters,handler}
// (`strict` is a property of the returned `Tool`, not a constructor option).
// Optional fields on this schema mean it must NOT run in OpenAI-compatible
// strict function-calling mode (strict requires every property `required`) —
// see tasks/README.md "Known pitfalls". `createTool` defaults `strict` to
// `Boolean(parameters)`, i.e. true, so this must be turned off explicitly.
savePostTool.strict = false;
