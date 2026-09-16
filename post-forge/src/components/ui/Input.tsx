import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const fieldBase =
  "w-full rounded-[var(--radius-md)] border bg-white px-3 text-sm text-gray-900 " +
  "placeholder:text-gray-400 shadow-[var(--shadow-xs)] transition-colors " +
  "duration-[var(--duration-fast)] ease-[var(--ease-standard)] " +
  "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, hint, error, leftIcon, rightIcon, id, ...props },
    ref,
  ) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 flex text-gray-400">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error || undefined}
            aria-describedby={describedBy}
            className={cn(
              fieldBase,
              "h-10",
              !!leftIcon && "pl-9",
              !!rightIcon && "pr-9",
              error
                ? "border-error-500 focus-visible:outline-error-500"
                : "border-border-strong hover:border-gray-400 focus-visible:border-brand-500",
              className,
            )}
            {...props}
          />
          {rightIcon && (
            <span className="pointer-events-none absolute right-3 flex text-gray-400">
              {rightIcon}
            </span>
          )}
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="text-sm text-error-600">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-sm text-gray-500">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";
