"use client";

import { useId, useState } from "react";
import type { KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

export interface PromptFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  /** Example topics shown as clickable chips beneath the field. */
  suggestions?: string[];
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  label?: string;
  className?: string;
}

/**
 * The hero-grade "topic → post" prompt field (DESIGN_PROMPT.md section 5 /
 * screen 5). Large, prominent, with example-topic chips and a primary
 * Generate action. Used on the marketing landing page and the New Post
 * screen (T09/T10).
 */
export function PromptField({
  value,
  onChange,
  onSubmit,
  placeholder = "e.g. “World Cup 2026”",
  suggestions = [],
  loading = false,
  disabled = false,
  error,
  label = "What should PostForge write about?",
  className,
}: PromptFieldProps) {
  const inputId = useId();
  const [focused, setFocused] = useState(false);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !loading && !disabled) onSubmit();
    }
  }

  return (
    <div className={cn("w-full max-w-2xl", className)}>
      {label && (
        <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div
        className={cn(
          "flex flex-col gap-3 rounded-[var(--radius-xl)] border bg-white p-3 shadow-[var(--shadow-md)]",
          "transition-shadow duration-[var(--duration-base)] ease-[var(--ease-standard)]",
          focused ? "border-brand-500 shadow-[var(--shadow-lg)]" : "border-border-strong",
          error && "border-error-500",
        )}
      >
        <textarea
          id={inputId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          aria-invalid={!!error || undefined}
          className="w-full resize-none border-0 bg-transparent text-lg font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400">Press Enter to generate, Shift+Enter for a new line</span>
          <Button
            size="lg"
            onClick={onSubmit}
            loading={loading}
            disabled={disabled || !value.trim()}
          >
            Generate
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-error-600">{error}</p>}
      {suggestions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className="rounded-[var(--radius-full)] border border-border bg-gray-50 px-3 py-1.5 text-sm text-gray-600 transition-colors duration-[var(--duration-fast)] hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
