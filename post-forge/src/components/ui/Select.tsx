import { forwardRef, useId } from "react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
}

/**
 * Native <select>, styled to match the system (used for the model picker and
 * image-provider picker per DESIGN_PROMPT.md section 5). Native element
 * keeps full keyboard/screen-reader behavior for free.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, hint, error, options, id, ...props }, ref) => {
    const autoId = useId();
    const selectId = id ?? autoId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={!!error || undefined}
            className={cn(
              "h-10 w-full appearance-none rounded-[var(--radius-md)] border bg-white pl-3 pr-9 text-sm text-gray-900",
              "shadow-[var(--shadow-xs)] transition-colors duration-[var(--duration-fast)]",
              "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
              error
                ? "border-error-500 focus-visible:outline-error-500"
                : "border-border-strong hover:border-gray-400 focus-visible:border-brand-500",
              className,
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
          >
            <path d="M5 7.5 10 12.5 15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {error ? (
          <p className="text-sm text-error-600">{error}</p>
        ) : hint ? (
          <p className="text-sm text-gray-500">{hint}</p>
        ) : null}
      </div>
    );
  },
);
Select.displayName = "Select";
