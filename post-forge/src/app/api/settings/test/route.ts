/**
 * `POST /api/settings/test` (T15 BRD 4/req.2): server-side connectivity
 * probes for the providers PostForge depends on. The Settings screen's
 * "Integrations" section calls this once per provider (never automatically
 * for all of them at once) to answer "is this configured and reachable?"
 * without ever accepting or echoing a secret — every credential is read
 * straight from `process.env` via `src/lib/env.ts` (T02), never from the
 * request body.
 *
 * Probe design, and why each one is the *cheapest* real check available:
 *
 * - `gemini` (text generation — research/verify/write/edit): calls Gemini's
 *   `GET /v1beta/models` endpoint, which authenticates the configured key
 *   and lists available models WITHOUT running any generation — no tokens
 *   spent, no cost, but a real round trip that proves the key is valid and
 *   Gemini is reachable. A 401/403/400 means "reachable, but the key is
 *   invalid"; any other non-2xx or a network error means "unreachable".
 *
 * - `image` (poster generation): a separate credential from Gemini —
 *   `src/lib/image.ts` uses Replicate (Gemini's own image models have zero
 *   free-tier quota on this project; see CLAUDE.md). Actually invoking
 *   `generatePoster()` here would generate (and pay for) a real image on
 *   every click of a "test connection" button, which is exactly the
 *   "spammable paid action" this route must avoid. Instead this probe calls
 *   Replicate's `GET /v1/account` endpoint, which authenticates the
 *   configured token and returns account info without running any
 *   prediction — no cost, but a real round trip that proves the token is
 *   valid and Replicate is reachable.
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
import { MissingEnvError, requireEnv, requireGeminiKey, requireReplicateKey } from "@/lib/env";
import { getDb } from "@/lib/mongo";
import { errorResponse } from "@/lib/http";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const REPLICATE_BASE_URL = "https://api.replicate.com/v1";
const SERPER_SEARCH_URL = "https://google.serper.dev/search";

export type SettingsTestProvider = "gemini" | "image" | "serper" | "mongodb";

export type SettingsTestResult = {
  provider: SettingsTestProvider;
  ok: boolean;
  message: string;
};

const requestSchema = z.object({
  provider: z.enum(["gemini", "image", "serper", "mongodb"]),
});

function missingKeyMessage(err: unknown, label: string): string {
  if (err instanceof MissingEnvError) {
    return `${label} is not configured (${err.message.replace("MissingEnvError: ", "")}).`;
  }
  return err instanceof Error ? err.message : `Failed to check ${label}.`;
}

async function testGemini(): Promise<SettingsTestResult> {
  let apiKey: string;
  try {
    apiKey = requireGeminiKey();
  } catch (err) {
    return { provider: "gemini", ok: false, message: missingKeyMessage(err, "GEMINI_API_KEY") };
  }

  try {
    const res = await fetch(`${GEMINI_BASE_URL}/models`, {
      headers: { "x-goog-api-key": apiKey },
    });
    if (res.status === 401 || res.status === 403 || res.status === 400) {
      return { provider: "gemini", ok: false, message: "Gemini rejected the configured API key." };
    }
    if (!res.ok) {
      return { provider: "gemini", ok: false, message: `Gemini responded with status ${res.status}.` };
    }
    return {
      provider: "gemini",
      ok: true,
      message: "Gemini key is valid and reachable (text generation).",
    };
  } catch (err) {
    return {
      provider: "gemini",
      ok: false,
      message: `Could not reach Gemini: ${err instanceof Error ? err.message : "network error"}.`,
    };
  }
}

async function testImageProvider(): Promise<SettingsTestResult> {
  let apiKey: string;
  try {
    apiKey = requireReplicateKey();
  } catch (err) {
    return { provider: "image", ok: false, message: missingKeyMessage(err, "REPLICATE_API_KEY") };
  }

  try {
    const res = await fetch(`${REPLICATE_BASE_URL}/account`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 401 || res.status === 403) {
      return { provider: "image", ok: false, message: "Replicate rejected the configured API token." };
    }
    if (!res.ok) {
      return { provider: "image", ok: false, message: `Replicate responded with status ${res.status}.` };
    }
    return {
      provider: "image",
      ok: true,
      message: "Replicate token is valid and reachable (poster images).",
    };
  } catch (err) {
    return {
      provider: "image",
      ok: false,
      message: `Could not reach Replicate: ${err instanceof Error ? err.message : "network error"}.`,
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
    return errorResponse(400, 'Body must be { provider: "gemini"|"image"|"serper"|"mongodb" }', "invalid_request");
  }

  const { provider } = parsed.data;
  let result: SettingsTestResult;
  switch (provider) {
    case "gemini":
      result = await testGemini();
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
