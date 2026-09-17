/**
 * `GET/PUT /api/settings` (T06 BRD 4.6): reads/writes generation defaults
 * via the T02 settings store. No key fields are ever accepted or returned
 * here (per CLAUDE.md's locked decision — API keys are env-only).
 */

import { NextResponse, type NextRequest } from "next/server";
import { ZodError, z } from "zod";
import { getSettings, putSettings } from "@/lib/settings-repo";
import type { SettingsDTO } from "@/lib/dto";
import { errorResponse, zodErrorMessage } from "@/lib/http";
import { generationOptionsSchema } from "@/app/api/generate/core";

// `PUT` accepts a partial update (any subset of generation defaults).
const settingsUpdateSchema = generationOptionsSchema.partial();

export async function GET() {
  try {
    const settings = await getSettings();
    const response: SettingsDTO = settings;
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load settings";
    return errorResponse(500, message, "get_settings_failed");
  }
}

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Request body must be valid JSON", "invalid_json");
  }

  let partial: z.infer<typeof settingsUpdateSchema>;
  try {
    partial = settingsUpdateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(400, zodErrorMessage(err), "invalid_request");
    }
    throw err;
  }

  try {
    const settings = await putSettings(partial);
    const response: SettingsDTO = settings;
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update settings";
    return errorResponse(500, message, "put_settings_failed");
  }
}
