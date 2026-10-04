import { Resend } from "resend";
import { requireResendKey, resendFromEmail } from "./env";

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const resend = new Resend(requireResendKey());
  const { error } = await resend.emails.send({
    from: resendFromEmail(),
    to,
    subject: `${code} is your PostForge verification code`,
    html: `<p>Your PostForge verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>This code expires in 10 minutes.</p>`,
  });
  if (error) {
    throw new Error(`Resend failed to send OTP email: ${error.message}`);
  }
}
