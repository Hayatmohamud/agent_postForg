/**
 * Poster image generation via OpenRouter (T02 orchestrator amendment).
 *
 * All image generation goes through OpenRouter — no direct `@google/genai`
 * or OpenAI-SDK provider calls. This module does NOT touch GridFS; callers
 * (the `generate_poster` tool, T03) store the returned bytes.
 *
 * Request/response shape verified against OpenRouter's current published
 * docs (2026-09, via web search — Context7 has no OpenRouter docs entry):
 * OpenRouter's dedicated image-generation endpoint is
 *   POST https://openrouter.ai/api/v1/images
 *   body: { model, prompt, n?, resolution?, aspect_ratio?, quality?, output_format? }
 *   response: { created, data: [{ b64_json, media_type }], usage }
 * This superseded an older chat-completions-based approach (some docs/blog
 * posts describe `POST /chat/completions` with `modalities: ["image","text"]`
 * returning `message.images[].image_url.url` as a data: URL — used by some
 * Gemini "nano banana"-style image models). Since this could not be
 * confirmed against a live key in this environment, this module tries the
 * dedicated `/images` endpoint first (the current, better-documented path)
 * and falls back to parsing the chat-completions `modalities` shape if the
 * `/images` call 404s/errors, so either provider behavior works without
 * caller changes. See tasks/reports.jsonl for the live-verification report.
 */

import { env, requireOpenRouterKey } from "./env";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image";

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

function resolveModel(modelOverride?: string): string {
  return modelOverride ?? env("IMAGE_MODEL") ?? DEFAULT_IMAGE_MODEL;
}

function dataUrlToBuffer(dataUrl: string): { bytes: Buffer; mime: string } {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) {
    throw new ImageGenerationError(
      "unrecognized image data URL format in chat-completions response"
    );
  }
  const [, mime, base64] = match;
  return { bytes: Buffer.from(base64, "base64"), mime };
}

/**
 * Calls OpenRouter's dedicated image-generation endpoint.
 * Returns `undefined` (rather than throwing) on a 404, so the caller can
 * fall back to the chat-completions shape for models that don't support it.
 */
async function generateViaImagesEndpoint(
  prompt: string,
  model: string,
  apiKey: string
): Promise<GeneratedImage | undefined> {
  const res = await fetch(`${OPENROUTER_BASE_URL}/images`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, prompt, n: 1 }),
  });

  if (res.status === 404) {
    return undefined;
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ImageGenerationError(
      `OpenRouter /images request failed with status ${res.status}: ${body}`
    );
  }

  const json = (await res.json()) as {
    data?: { b64_json?: string; media_type?: string }[];
    error?: { message?: string };
  };

  if (json.error) {
    throw new ImageGenerationError(json.error.message ?? "unknown OpenRouter error");
  }

  const first = json.data?.[0];
  if (!first?.b64_json) {
    return undefined;
  }

  return {
    bytes: Buffer.from(first.b64_json, "base64"),
    mime: first.media_type ?? "image/png",
  };
}

/**
 * Falls back to OpenRouter chat-completions with `modalities: ["image","text"]`,
 * for image models exposed only via that path.
 */
async function generateViaChatCompletions(
  prompt: string,
  model: string,
  apiKey: string
): Promise<GeneratedImage> {
  const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      modalities: ["image", "text"],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ImageGenerationError(
      `OpenRouter chat-completions image request failed with status ${res.status}: ${body}`
    );
  }

  const json = (await res.json()) as {
    choices?: {
      message?: {
        images?: { image_url?: { url?: string } }[];
      };
    }[];
    error?: { message?: string };
  };

  if (json.error) {
    throw new ImageGenerationError(json.error.message ?? "unknown OpenRouter error");
  }

  const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl) {
    throw new ImageGenerationError(
      "no image returned by OpenRouter (neither /images nor chat-completions modalities produced image data)"
    );
  }

  return dataUrlToBuffer(dataUrl);
}

/**
 * Generates a poster image for `prompt` via OpenRouter, using
 * `modelOverride ?? IMAGE_MODEL ?? "google/gemini-3.1-flash-image"`.
 * Returns raw bytes + mime type. Does not touch GridFS.
 */
export async function generatePoster(
  prompt: string,
  modelOverride?: string
): Promise<GeneratedImage> {
  let apiKey: string;
  try {
    apiKey = requireOpenRouterKey();
  } catch (err) {
    throw new ImageGenerationError("missing OPENROUTER_API_KEY", { cause: err });
  }

  const model = resolveModel(modelOverride);

  try {
    const viaImages = await generateViaImagesEndpoint(prompt, model, apiKey);
    if (viaImages) {
      return viaImages;
    }
    return await generateViaChatCompletions(prompt, model, apiKey);
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
