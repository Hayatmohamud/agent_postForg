/**
 * Email+password accounts, stored in our own `users` collection — deliberately
 * NOT via `@auth/mongodb-adapter` (see CLAUDE.md: that package's latest
 * release requires `mongodb@^6`, this project is pinned to `^7`). Auth.js's
 * `Credentials` provider (`src/auth.ts`) reads/writes through this module
 * directly; Google/GitHub OAuth sessions never touch this collection.
 */
import bcrypt from "bcryptjs";
import { getDb } from "./mongo";

const BCRYPT_ROUNDS = 12;

export interface UserDoc {
  _id: string; // normalized (lowercased, trimmed) email — also the unique key
  email: string;
  name: string;
  passwordHash: string;
  emailVerified: Date | null;
  createdAt: Date;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function usersCollection() {
  const db = await getDb();
  const collection = db.collection<UserDoc>("users");
  await collection.createIndex({ email: 1 }, { unique: true });
  return collection;
}

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  const collection = await usersCollection();
  return collection.findOne({ _id: normalizeEmail(email) });
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("An account with that email already exists.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

/**
 * Creates an unverified user with a hashed password, for a brand-new sign-up.
 * If an *unverified* account already exists for this email (an abandoned
 * sign-up that never completed OTP verification), its name/password are
 * refreshed instead of erroring — that lets someone retry a typo'd password
 * without getting stuck. A *verified* account with this email throws
 * `EmailAlreadyRegisteredError`.
 */
export async function createOrRefreshUnverifiedUser(params: {
  email: string;
  name: string;
  password: string;
}): Promise<UserDoc> {
  const collection = await usersCollection();
  const key = normalizeEmail(params.email);
  const passwordHash = await bcrypt.hash(params.password, BCRYPT_ROUNDS);

  const existing = await collection.findOne({ _id: key });
  if (existing?.emailVerified) throw new EmailAlreadyRegisteredError();

  const doc: UserDoc = {
    _id: key,
    email: key,
    name: params.name.trim(),
    passwordHash,
    emailVerified: null,
    createdAt: existing?.createdAt ?? new Date(),
  };
  await collection.replaceOne({ _id: key }, doc, { upsert: true });
  return doc;
}

export async function markEmailVerified(email: string): Promise<void> {
  const collection = await usersCollection();
  await collection.updateOne({ _id: normalizeEmail(email) }, { $set: { emailVerified: new Date() } });
}

export async function verifyPassword(email: string, password: string): Promise<UserDoc | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}
