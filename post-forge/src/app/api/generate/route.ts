/**
 * `POST /api/generate` (T06 BRD 4.1): validates `{ topic, options }`,
 * creates the post doc + mints `runId` (owned here, not by T05's Inngest
 * function), emits `post/generate.requested`, and returns `{ id, runId }`
 * for the client to navigate to / start polling.
 *
 * The actual logic lives in `./core.ts` (`createGenerationRun`) rather than
 * being exported alongside `POST` from this file: Next.js's route-file
 * export validation only allows HTTP-method exports from `route.ts`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { generateRequestSchema, createGenerationRun } from "./core";
import { errorResponse, zodErrorMessage } from "@/lib/http";
import type { GenerateResponse } from "@/lib/dto";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Request body must be valid JSON", "invalid_json");
  }

  let input;
  try {
    input = generateRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(400, zodErrorMessage(err), "invalid_request");
    }
    throw err;
  }

  try {
    const result = await createGenerationRun(input);
    const response: GenerateResponse = result;
    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start generation run";
    return errorResponse(500, message, "generate_failed");
  }
}
