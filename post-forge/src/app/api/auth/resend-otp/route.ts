/**
 * `POST /api/auth/resend-otp` — re-sends a fresh verification code, for the
 * sign-up OTP step's "Didn't get a code?" action, and for a sign-in attempt
 * that failed with `email-not-verified` (see `(auth)/sign-in`).
 */
import { z } from "zod";
import { errorResponse, zodErrorMessage } from "@/lib/http";
import { findUserByEmail } from "@/lib/users-repo";
import { issueOtp, OtpCooldownError } from "@/lib/otp-repo";
import { sendOtpEmail } from "@/lib/email";

const bodySchema = z.object({ email: z.string().trim().email() });

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
  const { email } = parsed.data;

  const user = await findUserByEmail(email);
  // Don't reveal whether the account exists — always report success unless
  // there's a real send failure. If it doesn't exist there's just no email.
  if (!user || user.emailVerified) {
    return Response.json({ ok: true });
  }

  try {
    const code = await issueOtp(email);
    await sendOtpEmail(email, code);
  } catch (err) {
    if (err instanceof OtpCooldownError) {
      return errorResponse(429, err.message, "cooldown");
    }
    return errorResponse(502, err instanceof Error ? err.message : "Failed to send verification email.", "email_send_failed");
  }

  return Response.json({ ok: true });
}
