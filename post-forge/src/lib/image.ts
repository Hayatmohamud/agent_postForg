/**
 * Poster image generation via Replicate.
 *
 * Text generation still goes through Gemini (`src/lib/models.ts`), but
 * poster images go through Replicate — a separate credential, per an
 * explicit user decision after discovering the configured `GEMINI_API_KEY`
 * has zero free-tier quota for every image-generation model tested (see
 * CLAUDE.md's env-contract note). This module does NOT touch GridFS;
 * callers (the `generate_poster` tool) store the returned bytes.
 *
 * Request/response shape verified against Replicate's current published docs
 * (2026-09, live fetch, plus a real end-to-end generation call): official
 * models are run via
 *   POST https://api.replicate.com/v1/models/{owner}/{name}/predictions
 *   headers: Authorization: Bearer <token>, Prefer: wait=60
 *   body: { input: { prompt, ... } }
 * With `Prefer: wait`, Replicate holds the connection open and returns a
 * completed (or still-processing, if it ran long) prediction object in one
 * response. `output` is a URL (or array of URLs) to the generated image,
 * which this module then fetches and returns as raw bytes. If the
 * synchronous wait window elapses before completion, this module falls back
 * to polling `GET /v1/predictions/{id}` until the prediction settles.
 */

import { env, requireReplicateKey } from "./env";

const REPLICATE_BASE_URL = "https://api.replicate.com/v1";
const DEFAULT_IMAGE_MODEL = "black-forest-labs/flux-schnell";
const SYNC_WAIT_SECONDS = 60;
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export class ImageGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`ImageGenerationError: ${message}`);
    this.name = "ImageGenerationError";
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export type GeneratedImage = { bytes: Buffer; mime: string };

type ReplicatePrediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[];
  error?: string | null;
  urls?: { get?: string };
};

function resolveModel(modelOverride?: string): string {
  return modelOverride ?? env("IMAGE_MODEL") ?? DEFAULT_IMAGE_MODEL;
}

function splitModel(model: string): { owner: string; name: string } {
  const [owner, name] = model.split("/");
  if (!owner || !name) {
    throw new ImageGenerationError(
      `invalid Replicate model id "${model}" — expected "owner/name"`
    );
  }
  return { owner, name };
}

function outputToUrl(output: ReplicatePrediction["output"]): string | undefined {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output[0];
  return undefined;
}

async function waitForPrediction(
  prediction: ReplicatePrediction,
  apiKey: string
): Promise<ReplicatePrediction> {
  if (prediction.status === "succeeded" || prediction.status === "failed" || prediction.status === "canceled") {
    return prediction;
  }

  const getUrl = prediction.urls?.get ?? `${REPLICATE_BASE_URL}/predictions/${prediction.id}`;
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const res = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ImageGenerationError(
        `Replicate prediction poll failed with status ${res.status}: ${body}`
      );
    }
    const json = (await res.json()) as ReplicatePrediction;
    if (json.status === "succeeded" || json.status === "failed" || json.status === "canceled") {
      return json;
    }
  }

  throw new ImageGenerationError(
    `Replicate prediction ${prediction.id} did not finish within ${POLL_TIMEOUT_MS / 1000}s`
  );
}

async function fetchImageBytes(url: string): Promise<GeneratedImage> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ImageGenerationError(`failed to download generated image (status ${res.status})`);
  }
  const mime = res.headers.get("content-type") ?? "image/png";
  const arrayBuffer = await res.arrayBuffer();
  return { bytes: Buffer.from(arrayBuffer), mime };
}

/**
 * Generates a poster image for `prompt` via Replicate, using
 * `modelOverride ?? IMAGE_MODEL ?? "black-forest-labs/flux-schnell"`.
 * Returns raw bytes + mime type. Does not touch GridFS.
 */
export async function generatePoster(
  prompt: string,
  modelOverride?: string
): Promise<GeneratedImage> {
  let apiKey: string;
  try {
    apiKey = requireReplicateKey();
  } catch (err) {
    throw new ImageGenerationError("missing REPLICATE_API_KEY", { cause: err });
  }

  const model = resolveModel(modelOverride);
  const { owner, name } = splitModel(model);

  try {
    const res = await fetch(`${REPLICATE_BASE_URL}/models/${owner}/${name}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Prefer: `wait=${SYNC_WAIT_SECONDS}`,
      },
      body: JSON.stringify({ input: { prompt } }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ImageGenerationError(
        `Replicate prediction request failed with status ${res.status}: ${body}`
      );
    }

    let prediction = (await res.json()) as ReplicatePrediction;
    prediction = await waitForPrediction(prediction, apiKey);

    if (prediction.status === "failed" || prediction.status === "canceled") {
      throw new ImageGenerationError(
        `Replicate prediction ${prediction.status}: ${prediction.error ?? "no error detail"}`
      );
    }

    const url = outputToUrl(prediction.output);
    if (!url) {
      throw new ImageGenerationError("Replicate prediction succeeded but returned no output URL");
    }

    return await fetchImageBytes(url);
  } catch (err) {
    if (err instanceof ImageGenerationError) {
      throw err;
    }
    throw new ImageGenerationError(
      err instanceof Error ? err.message : "unknown error generating poster",
      { cause: err }
    );
  }
}
