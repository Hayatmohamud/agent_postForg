"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { AuthCard } from "@/components/auth/AuthCard";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { OtpForm, type OtpSubmitResult } from "@/components/auth/OtpForm";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: "That email is already linked to a different sign-in provider.",
  AccessDenied: "Access was denied by the provider.",
};

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: data?.error?.message ?? "Something went wrong. Please try again." };
  return { ok: true };
}

/**
 * Sign-in — Google/GitHub OAuth, or email + password via the Credentials
 * provider. A password login for an account stuck at `email-not-verified`
 * (an abandoned sign-up) drops into the same OTP step sign-up uses, sends a
 * fresh code, then retries the credentials login on success — instead of
 * dead-ending the user with no way to finish verifying.
 */
export default function SignInPage() {
  return (
    <Suspense>
      <SignInCard />
    </Suspense>
  );
}

function SignInCard() {
  const params = useSearchParams();
  const router = useRouter();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";
  const oauthError = params.get("error");

  const [step, setStep] = useState<"form" | "otp">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setLoading(true);

    const result = await signIn("credentials", { email: email.trim(), password, redirect: false });

    if (!result?.error) {
      setLoading(false);
      router.push(callbackUrl);
      return;
    }

    if (result.code === "email-not-verified") {
      const resend = await postJson("/api/auth/resend-otp", { email: email.trim() });
      setLoading(false);
      if (!resend.ok) {
        setFormError(resend.message ?? "Couldn't send a verification code. Try again shortly.");
        return;
      }
      setStep("otp");
      return;
    }

    setLoading(false);
    setFormError("Incorrect email or password.");
  }

  async function handleVerify(code: string): Promise<OtpSubmitResult> {
    const verifyResult = await postJson("/api/auth/verify-otp", { email: email.trim(), code });
    if (!verifyResult.ok) return { ok: false, error: verifyResult.message };

    const signInResult = await signIn("credentials", { email: email.trim(), password, redirect: false });
    if (signInResult?.error) {
      return { ok: false, error: "Verified, but sign-in failed — try again." };
    }
    router.push(callbackUrl);
    return { ok: true };
  }

  async function handleResend(): Promise<OtpSubmitResult> {
    const result = await postJson("/api/auth/resend-otp", { email: email.trim() });
    return { ok: result.ok, error: result.message };
  }

  if (step === "otp") {
    return (
      <AuthCard title="Verify your email" description="Your account still needs email verification.">
        <OtpForm email={email.trim()} onSubmit={handleVerify} onResend={handleResend} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to continue to PostForge."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="font-medium text-brand-600 hover:text-brand-700">
            Sign up
          </Link>
        </>
      }
    >
      {oauthError && (
        <p role="alert" className="mb-4 rounded-[var(--radius-md)] bg-error-50 px-3 py-2 text-sm text-error-700">
          {ERROR_MESSAGES[oauthError] ?? "Something went wrong signing you in. Please try again."}
        </p>
      )}
      <SocialAuthButtons callbackUrl={callbackUrl} disabled={loading} />

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-wide text-gray-400">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {formError && (
        <p role="alert" className="mb-4 rounded-[var(--radius-md)] bg-error-50 px-3 py-2 text-sm text-error-700">
          {formError}
        </p>
      )}

      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          type="email"
          autoComplete="email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
        <Input
          type="password"
          autoComplete="current-password"
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
        <Button type="submit" fullWidth loading={loading} className="mt-1">
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
