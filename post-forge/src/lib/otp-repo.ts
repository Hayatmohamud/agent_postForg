/**
 * One-time email verification codes for sign-up (`src/app/api/auth/signup`,
 * `verify-otp`, `resend-otp` routes). One document per email — a new send
 * overwrites the previous code rather than accumulating history. A Mongo TTL
 * index auto-deletes expired documents, so an abandoned sign-up never
 * lingers.
 */
import bcrypt from "bcryptjs";
import { getDb } from "./mongo";

const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

export interface OtpDoc {
  _id: string; // normalized email
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  lastSentAt: Date;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function otpCollection() {
  const db = await getDb();
  const collection = db.collection<OtpDoc>("email_otps");
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return collection;
}

export class OtpCooldownError extends Error {
  constructor(public secondsRemaining: number) {
    super(`Please wait ${secondsRemaining}s before requesting another code.`);
    this.name = "OtpCooldownError";
  }
}

/** Generates a fresh 6-digit code, stores its hash, and returns the plaintext code to email. */
export async function issueOtp(email: string): Promise<string> {
  const collection = await otpCollection();
  const key = normalizeEmail(email);

  const existing = await collection.findOne({ _id: key });
  if (existing) {
    const elapsedMs = Date.now() - existing.lastSentAt.getTime();
    const remaining = RESEND_COOLDOWN_SECONDS - Math.floor(elapsedMs / 1000);
    if (remaining > 0) throw new OtpCooldownError(remaining);
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const now = new Date();
  await collection.updateOne(
    { _id: key },
    {
      $set: {
        codeHash,
        expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60_000),
        attempts: 0,
        lastSentAt: now,
      },
    },
    { upsert: true },
  );
  return code;
}

export type VerifyOtpResult = "ok" | "not_found" | "expired" | "too_many_attempts" | "incorrect";

/** Verifies a submitted code; consumes (deletes) the OTP doc on success. */
export async function verifyOtp(email: string, code: string): Promise<VerifyOtpResult> {
  const collection = await otpCollection();
  const key = normalizeEmail(email);
  const doc = await collection.findOne({ _id: key });
  if (!doc) return "not_found";
  if (doc.expiresAt.getTime() < Date.now()) {
    await collection.deleteOne({ _id: key });
    return "expired";
  }
  if (doc.attempts >= MAX_ATTEMPTS) return "too_many_attempts";

  const ok = await bcrypt.compare(code, doc.codeHash);
  if (!ok) {
    await collection.updateOne({ _id: key }, { $inc: { attempts: 1 } });
    return "incorrect";
  }
  await collection.deleteOne({ _id: key });
  return "ok";
}
