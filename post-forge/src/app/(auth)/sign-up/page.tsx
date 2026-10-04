"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { AuthCard } from "@/components/auth/AuthCard";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";
import { OtpForm, type OtpSubmitResult } from "@/components/auth/OtpForm";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function validate(name: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim()) errors.name = "Enter your name.";
  if (!email.trim()) {
    errors.email = "Enter your email address.";
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!password) {
    errors.password = "Choose a password.";
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return errors;
}

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
 * Sign-up — real accounts: Google/GitHub OAuth (`SocialAuthButtons`), or
 * email + password with mandatory email verification (`/api/auth/signup` ->
 * OTP step -> `/api/auth/verify-otp` -> client-side `signIn("credentials")`
 * completes the login). No account is usable until the OTP step succeeds.
 */
export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "otp">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const nextErrors = validate(name, email, password);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    const result = await postJson("/api/auth/signup", { name: name.trim(), email: email.trim(), password });
    setLoading(false);
    if (!result.ok) {
      setFormError(result.message ?? "Something went wrong.");
      return;
    }
    setStep("otp");
  }

  async function handleVerify(code: string): Promise<OtpSubmitResult> {
    const verifyResult = await postJson("/api/auth/verify-otp", { email: email.trim(), code });
    if (!verifyResult.ok) return { ok: false, error: verifyResult.message };

    const signInResult = await signIn("credentials", { email: email.trim(), password, redirect: false });
    if (signInResult?.error) {
      return { ok: false, error: "Verified, but sign-in failed — try signing in from the sign-in page." };
    }
    router.push("/dashboard");
    return { ok: true };
  }

  async function handleResend(): Promise<OtpSubmitResult> {
    const result = await postJson("/api/auth/resend-otp", { email: email.trim() });
    return { ok: result.ok, error: result.message };
  }

  if (step === "otp") {
    return (
      <AuthCard title="Verify your email" description="One more step to finish creating your account.">
        <OtpForm email={email.trim()} onSubmit={handleVerify} onResend={handleResend} />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      description="Start generating fully-sourced posts in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </>
      }
    >
      <SocialAuthButtons disabled={loading} callbackUrl="/dashboard" />

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
          type="text"
          autoComplete="name"
          label="Name"
          placeholder="Ada Lovelace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          disabled={loading}
        />
        <Input
          type="email"
          autoComplete="email"
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          disabled={loading}
        />
        <Input
          type="password"
          autoComplete="new-password"
          label="Password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          disabled={loading}
        />
        <Button type="submit" fullWidth loading={loading} className="mt-1">
          Create account
        </Button>
      </form>
      <p className="mt-4 text-center text-xs text-gray-400">
        By continuing you agree to PostForge&apos;s Terms and Privacy Policy.
      </p>
    </AuthCard>
  );
}
