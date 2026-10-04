/**
 * `generate_poster` AgentKit tool — generates a poster image and stores it
 * in GridFS.
 *
 * Reads `options.imageModel` (a Replicate model id, e.g.
 * "black-forest-labs/flux-schnell", NOT a provider name) from network state
 * and passes it straight through as `generatePoster`'s `modelOverride`. All
 * image generation goes through `src/lib/image.ts` (Replicate) — no direct
 * provider SDK calls here.
 */

import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { generatePoster } from "@/lib/image";
import { getBucket } from "@/lib/mongo";
import type { NetworkState } from "@/lib/state";

export class GeneratePosterToolError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`GeneratePosterToolError: ${message}`);
    this.name = "GeneratePosterToolError";
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

/** Uploads image bytes to the `posters` GridFS bucket, returning the file id. */
async function uploadToGridFs(
  bytes: Buffer,
  mime: string,
  postId: string | undefined
): Promise<string> {
  const bucket = await getBucket();
  return new Promise<string>((resolve, reject) => {
    // The installed mongodb driver's GridFS write-stream options have no
    // dedicated `contentType` field (older/newer driver versions do) — the
    // BRD's required `{mime, postId}` metadata carries the mime type, and
    // the poster route (T06) reads `file.metadata.mime` for Content-Type.
    const uploadStream = bucket.openUploadStream(`poster-${Date.now()}`, {
      metadata: { mime, postId },
    });
    uploadStream.once("error", reject);
    uploadStream.once("finish", () => resolve(uploadStream.id.toString()));
    uploadStream.end(bytes);
  });
}

export const generatePosterTool = createTool({
  name: "generate_poster",
  description:
    "Generates a poster image from a prompt (via Replicate) and stores it in GridFS, returning the stored image id.",
  parameters: z.object({ prompt: z.string() }),
  handler: async ({ prompt }, { network }): Promise<{ posterImageId: string }> => {
    const state = network.state.data as NetworkState;
    const postId = state.postId;
    const modelOverride = state.options?.imageModel;

    let image: { bytes: Buffer; mime: string };
    try {
      image = await generatePoster(prompt, modelOverride);
    } catch (err) {
      throw new GeneratePosterToolError(
        `poster generation failed: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }

    let posterImageId: string;
    try {
      posterImageId = await uploadToGridFs(image.bytes, image.mime, postId);
    } catch (err) {
      throw new GeneratePosterToolError(
        `failed to store poster in GridFS: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }

    state.posterImageId = posterImageId;
    return { posterImageId };
  },
});
