/**
 * `POST /api/auth/verify-otp` — second step of email+password sign-up:
 * checks the submitted 6-digit code against `src/lib/otp-repo.ts` and, on
 * success, marks the user verified. The client then signs in itself via
 * `signIn("credentials", ...)` — this route only verifies, never creates a
 * session.
 */
import { z } from "zod";
import { errorResponse, zodErrorMessage } from "@/lib/http";
import { verifyOtp } from "@/lib/otp-repo";
import { markEmailVerified } from "@/lib/users-repo";

const bodySchema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().length(6),
});

const MESSAGES: Record<string, string> = {
  not_found: "No verification code was found for this email. Request a new one.",
  expired: "This code has expired. Request a new one.",
  too_many_attempts: "Too many incorrect attempts. Request a new code.",
  incorrect: "That code is incorrect.",
};

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return errorResponse(400, "Request body must be valid JSON", "invalid_json");
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return errorResponse(400, zodErrorMessage(parsed.error), "invalid_request");
  }
  const { email, code } = parsed.data;

  const result = await verifyOtp(email, code);
  if (result !== "ok") {
    return errorResponse(400, MESSAGES[result], result);
  }

  await markEmailVerified(email);
  return Response.json({ ok: true });
}
