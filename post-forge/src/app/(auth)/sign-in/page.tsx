"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { AuthCard } from "@/components/auth/AuthCard";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
  password?: string;
}

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) {
    errors.email = "Enter your email address.";
  } else if (!EMAIL_RE.test(email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!password) {
    errors.password = "Enter your password.";
  }
  return errors;
}

/**
 * Sign-in — cosmetic auth only (locked decision, DESIGN_PROMPT.md /
 * tasks/T09-public-surface.md): there is no real session, API call, or user
 * record. Submit validates client-side, shows a loading state behind a fake
 * delay, then routes into the app shell (`/dashboard`, built by T08).
 */
export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const nextErrors = validate(email, password);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      // Stubbed submit: no real authentication happens here. We only
      // simulate network latency before navigating into the app shell.
      await new Promise((resolve) => setTimeout(resolve, 900));
      router.push("/dashboard");
    } catch {
      setFormError("Something went wrong signing you in. Please try again.");
      setLoading(false);
    }
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
      <SocialAuthButtons disabled={loading} />

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
          error={errors.email}
          disabled={loading}
        />
        <Input
          type="password"
          autoComplete="current-password"
          label="Password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          disabled={loading}
        />
        <Button type="submit" fullWidth loading={loading} className="mt-1">
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
