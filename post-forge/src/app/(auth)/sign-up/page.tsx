"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { AuthCard } from "@/components/auth/AuthCard";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function validate(name: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim()) {
    errors.name = "Enter your name.";
  }
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

/**
 * Sign-up — cosmetic auth only (locked decision, DESIGN_PROMPT.md /
 * tasks/T09-public-surface.md): there is no real session, API call, or user
 * record created. Submit validates client-side, shows a loading state behind
 * a fake delay, then routes into the app shell (`/dashboard`, built by T08).
 */
export default function SignUpPage() {
  const router = useRouter();
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
    try {
      // Stubbed submit: no account is actually created. We only simulate
      // network latency before navigating into the app shell.
      await new Promise((resolve) => setTimeout(resolve, 900));
      router.push("/dashboard");
    } catch {
      setFormError("Something went wrong creating your account. Please try again.");
      setLoading(false);
    }
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
