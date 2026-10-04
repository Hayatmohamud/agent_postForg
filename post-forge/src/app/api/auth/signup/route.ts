/**
 * `POST /api/auth/signup` — first step of email+password sign-up: creates
 * an unverified user record and emails a 6-digit OTP via Resend. The client
 * (`(auth)/sign-up`) then collects the code and calls `verify-otp`, then
 * signs in with the Credentials provider (`src/auth.ts`) directly — this
 * route never creates a session itself.
 */
import { z } from "zod";
import { errorResponse, zodErrorMessage } from "@/lib/http";
import { createOrRefreshUnverifiedUser, EmailAlreadyRegisteredError } from "@/lib/users-repo";
import { issueOtp, OtpCooldownError } from "@/lib/otp-repo";
import { sendOtpEmail } from "@/lib/email";

const bodySchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

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
  const { name, email, password } = parsed.data;

  try {
    await createOrRefreshUnverifiedUser({ name, email, password });
  } catch (err) {
    if (err instanceof EmailAlreadyRegisteredError) {
      return errorResponse(409, err.message, "email_already_registered");
    }
    throw err;
  }

  try {
    const code = await issueOtp(email);
    await sendOtpEmail(email, code);
  } catch (err) {
    if (err instanceof OtpCooldownError) {
      // A code was already sent recently — the user can still proceed to
      // the verification step with the one already in their inbox.
      return Response.json({ ok: true });
    }
    return errorResponse(502, err instanceof Error ? err.message : "Failed to send verification email.", "email_send_failed");
  }

  return Response.json({ ok: true });
}
