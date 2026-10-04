/**
 * Auth.js (NextAuth v5) config — real Google + GitHub OAuth, plus email +
 * password (with mandatory email-OTP verification, see `src/lib/otp-repo.ts`
 * / `src/lib/email.ts`), per explicit user decisions superseding the earlier
 * "auth is a cosmetic stub" locked decision in CLAUDE.md.
 *
 * JWT session strategy (Auth.js's default when no `adapter` is given, and
 * mandatory for the `Credentials` provider) — deliberately NOT using
 * `@auth/mongodb-adapter`: its current release only supports `mongodb@^6`,
 * and this project is pinned to `mongodb@^7` (see CLAUDE.md's version
 * table). Email+password accounts still need *some* persistent record
 * (unlike pure-OAuth sessions), so they live in our own `users` collection
 * (`src/lib/users-repo.ts`), written to directly with the existing `mongodb`
 * driver — no adapter package involved. The app is still single-tenant (no
 * `userId` on posts); this collection exists only to authenticate, not to
 * scope data.
 *
 * Verified against Auth.js's current live docs (2026-09, Context7):
 * base config shape, provider env var convention (`AUTH_GOOGLE_ID`/
 * `AUTH_GOOGLE_SECRET`, `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET` — Auth.js
 * infers these automatically from each provider's name, no need to pass
 * `clientId`/`clientSecret` explicitly), the `proxy.ts` route-protection
 * pattern (`src/proxy.ts`), the `Credentials` provider's `authorize()`
 * contract, and the `CredentialsSignin` subclass pattern for surfacing a
 * specific error `code` back to the client via `signIn(..., {redirect:false})`.
 */

import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { verifyPassword } from "@/lib/users-repo";

/** Generic on purpose (see Auth.js's own guidance) — never hints whether the email or the password was wrong. */
export class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid-credentials";
}

/** Distinguished from `InvalidCredentialsError` so the sign-in form can offer "resend the code" specifically. */
export class EmailNotVerifiedError extends CredentialsSignin {
  code = "email-not-verified";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google,
    GitHub,
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) throw new InvalidCredentialsError();

        const user = await verifyPassword(email, password);
        if (!user) throw new InvalidCredentialsError();
        if (!user.emailVerified) throw new EmailNotVerifiedError();

        return { id: user._id, email: user.email, name: user.name };
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
});
