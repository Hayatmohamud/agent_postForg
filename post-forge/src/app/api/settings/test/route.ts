/**
 * `POST /api/settings/test` (T15 BRD 4/req.2): server-side connectivity
 * probes for the four providers PostForge depends on. The Settings screen's
 * "Integrations" section calls this once per provider (never automatically
 * for all of them at once) to answer "is this configured and reachable?"
 * without ever accepting or echoing a secret — every credential is read
 * straight from `process.env` via `src/lib/env.ts` (T02), never from the
 * request body.
 *
 * Probe design, and why each one is the *cheapest* real check available:
 *
 * - `openrouter` (text generation): calls OpenRouter's `GET /api/v1/key`
 *   endpoint, which authenticates the configured key and returns account/
 *   usage info WITHOUT running any model inference — no tokens spent, no
 *   cost, but a real round trip that proves the key is valid and OpenRouter
 *   is reachable. A 401/403 means "reachable, but the key is invalid"; any
 *   other non-2xx or a network error means "unreachable".
 *
 * - `image` (poster generation): PostForge routes image generation through
 *   the same OpenRouter credential as text (`src/lib/image.ts`, T02
 *   amendment) — there is no separate image-provider key. Actually invoking
 *   `generatePoster()` here would generate (and pay for) a real image on
 *   every click of a "test connection" button, which is exactly the
 *   "spammable paid action" this route must avoid. Since there is no
 *   dedicated lightweight "validate this image model id" endpoint on
 *   OpenRouter, this probe reuses the same free `/api/v1/key` auth check as
 *   `openrouter` (same credential) and additionally confirms the
 *   configured/default `IMAGE_MODEL` id is present in OpenRouter's public
 *   `GET /api/v1/models` catalog (also free, no auth required, no
 *   inference) — a good-faith reachability + "this model id exists" check
 *   that stops well short of a real, billable generation.
 *
 * - `serper` (web search): Serper has no separate free "check my key"
 *   endpoint, so this fires one real search for a trivial fixed query
 *   ("ping") against the same endpoint `src/agents/tools/web_search.ts`
 *   (T03) uses. This costs one search credit, matching this task's BRD note
 *   that a trivial-query probe is an acceptable way to test Serper.
 *
 * - `mongodb` (persistence): runs `db.command({ ping: 1 })` via
 *   `src/lib/mongo.ts`'s `getDb()` (T02) — MongoDB's own dedicated,
 *   zero-cost liveness check.
 *
 * Every branch below catches its own errors and always resolves to
 * `{ provider, ok, message }` — this route itself never throws or returns
 * a raw 500 for a provider-side failure; `message` is always a short,
 * human-readable summary and never includes the secret value itself.
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env, MissingEnvError, requireOpenRouterKey, requireEnv } from "@/lib/env";
import { getDb } from "@/lib/mongo";
import { errorResponse } from "@/lib/http";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const SERPER_SEARCH_URL = "https://google.serper.dev/search";
// Same default as src/lib/image.ts's DEFAULT_IMAGE_MODEL — duplicated here
// (rather than imported) because that constant isn't exported; kept in sync
// by inspection since both live in this repo.
const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image";

export type SettingsTestProvider = "openrouter" | "serper" | "image" | "mongodb";

export type SettingsTestResult = {
  provider: SettingsTestProvider;
  ok: boolean;
  message: string;
};

const requestSchema = z.object({
  provider: z.enum(["openrouter", "serper", "image", "mongodb"]),
});

function missingKeyMessage(err: unknown, label: string): string {
  if (err instanceof MissingEnvError) {
    return `${label} is not configured (${err.message.replace("MissingEnvError: ", "")}).`;
  }
  return err instanceof Error ? err.message : `Failed to check ${label}.`;
}

async function testOpenRouter(): Promise<SettingsTestResult> {
  let apiKey: string;
  try {
    apiKey = requireOpenRouterKey();
  } catch (err) {
    return { provider: "openrouter", ok: false, message: missingKeyMessage(err, "OPENROUTER_API_KEY") };
  }

  try {
    const res = await fetch(`${OPENROUTER_BASE_URL}/key`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { provider: "openrouter", ok: false, message: "OpenRouter rejected the configured API key." };
    }
    if (!res.ok) {
      return {
        provider: "openrouter",
        ok: false,
        message: `OpenRouter responded with status ${res.status}.`,
      };
    }
    return { provider: "openrouter", ok: true, message: "OpenRouter key is valid and reachable." };
  } catch (err) {
    return {
      provider: "openrouter",
      ok: false,
      message: `Could not reach OpenRouter: ${err instanceof Error ? err.message : "network error"}.`,
    };
  }
}

async function testImageProvider(): Promise<SettingsTestResult> {
  let apiKey: string;
  try {
    apiKey = requireOpenRouterKey();
  } catch (err) {
    return { provider: "image", ok: false, message: missingKeyMessage(err, "OPENROUTER_API_KEY") };
  }

  const model = env("IMAGE_MODEL") ?? DEFAULT_IMAGE_MODEL;

  try {
    const keyRes = await fetch(`${OPENROUTER_BASE_URL}/key`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (keyRes.status === 401 || keyRes.status === 403) {
      return { provider: "image", ok: false, message: "OpenRouter rejected the configured API key." };
    }
    if (!keyRes.ok) {
      return { provider: "image", ok: false, message: `OpenRouter responded with status ${keyRes.status}.` };
    }

    // Free, unauthenticated catalog lookup — confirms the configured image
    // model id is one OpenRouter actually serves, without generating an image.
    const modelsRes = await fetch(`${OPENROUTER_BASE_URL}/models`);
    if (modelsRes.ok) {
      const json = (await modelsRes.json().catch(() => null)) as { data?: { id?: string }[] } | null;
      const ids = json?.data?.map((m) => m.id) ?? [];
      if (ids.length > 0 && !ids.includes(model)) {
        return {
          provider: "image",
          ok: false,
          message: `Key is valid, but image model "${model}" was not found in OpenRouter's catalog.`,
        };
      }
    }

    return {
      provider: "image",
      ok: true,
      message: `OpenRouter key is valid; image model "${model}" is configured. (No image was generated by this test.)`,
    };
  } catch (err) {
    return {
      provider: "image",
      ok: false,
      message: `Could not reach OpenRouter: ${err instanceof Error ? err.message : "network error"}.`,
    };
  }
}

async function testSerper(): Promise<SettingsTestResult> {
  let apiKey: string;
  try {
    apiKey = requireEnv("SERPER_API_KEY");
  } catch (err) {
    return { provider: "serper", ok: false, message: missingKeyMessage(err, "SERPER_API_KEY") };
  }

  try {
    const res = await fetch(SERPER_SEARCH_URL, {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: "ping" }),
    });
    if (res.status === 401 || res.status === 403) {
      return { provider: "serper", ok: false, message: "Serper rejected the configured API key." };
    }
    if (!res.ok) {
      return { provider: "serper", ok: false, message: `Serper responded with status ${res.status}.` };
    }
    return { provider: "serper", ok: true, message: "Serper key is valid and reachable." };
  } catch (err) {
    return {
      provider: "serper",
      ok: false,
      message: `Could not reach Serper: ${err instanceof Error ? err.message : "network error"}.`,
    };
  }
}

async function testMongo(): Promise<SettingsTestResult> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return { provider: "mongodb", ok: true, message: "MongoDB is reachable." };
  } catch (err) {
    return { provider: "mongodb", ok: false, message: missingKeyMessage(err, "MONGODB_URI") };
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Request body must be valid JSON", "invalid_json");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, 'Body must be { provider: "openrouter"|"serper"|"image"|"mongodb" }', "invalid_request");
  }

  const { provider } = parsed.data;
  let result: SettingsTestResult;
  switch (provider) {
    case "openrouter":
      result = await testOpenRouter();
      break;
    case "image":
      result = await testImageProvider();
      break;
    case "serper":
      result = await testSerper();
      break;
    case "mongodb":
      result = await testMongo();
      break;
  }

  return NextResponse.json(result);
}
