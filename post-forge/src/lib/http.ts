/**
 * Small shared helpers for API route handlers (T06): a consistent way to
 * build the standard `{ error: { message, code? } }` JSON error shape
 * (`src/lib/dto.ts`'s `ErrorResponse`) so every route returns the same
 * shape instead of ad-hoc `NextResponse.json({...})` calls.
 */

import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import type { ErrorResponse } from "./dto";

/** Builds a JSON error response with the standard `ErrorResponse` shape. */
export function errorResponse(status: number, message: string, code?: string) {
  const body: ErrorResponse = { error: { message, code } };
  return NextResponse.json(body, { status });
}

/** Flattens a zod validation error into a single readable message. */
export function zodErrorMessage(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}
