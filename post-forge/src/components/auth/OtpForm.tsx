"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Input } from "@/components/ui";

export interface OtpSubmitResult {
  ok: boolean;
  error?: string;
}

/**
 * Shared 6-digit code entry step for both the sign-up (post-signup email
 * verification) and sign-in (verify-then-retry-login) OTP flows. Purely
 * presentational/stateful — callers own what "submit" and "resend" actually
 * do against the API.
 */
export function OtpForm({
  email,
  onSubmit,
  onResend,
}: {
  email: string;
  onSubmit: (code: string) => Promise<OtpSubmitResult>;
  onResend: () => Promise<OtpSubmitResult>;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    const result = await onSubmit(code.trim());
    setLoading(false);
    if (!result.ok) setError(result.error ?? "Verification failed.");
  }

  async function handleResend() {
    setError(null);
    setResendMessage(null);
    setResending(true);
    const result = await onResend();
    setResending(false);
    setResendMessage(result.ok ? "A new code has been sent." : (result.error ?? "Couldn't resend the code."));
  }

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        We sent a 6-digit code to <span className="font-medium text-text">{email}</span>. Enter it below to verify
        your email.
      </p>
      {error && (
        <p role="alert" className="mb-4 rounded-[var(--radius-md)] bg-error-50 px-3 py-2 text-sm text-error-700">
          {error}
        </p>
      )}
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <Input
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          autoFocus
        />
        <Button type="submit" fullWidth loading={loading}>
          Verify
        </Button>
      </form>
      <div className="mt-4 text-center text-sm text-gray-500">
        Didn&apos;t get a code?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
        >
          Resend
        </button>
      </div>
      {resendMessage && <p className="mt-2 text-center text-xs text-gray-400">{resendMessage}</p>}
    </div>
  );
}
