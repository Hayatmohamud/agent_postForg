import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ErrorStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Reusable error block for data screens (failed fetch, agent-run failure,
 * etc). Visually a variant of EmptyState but on the error palette, so a
 * screen can tell "no data yet" from "something went wrong" at a glance.
 */
export function ErrorState({ icon, title, description, action, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-xl)] border border-error-100 bg-error-50 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-full)] bg-white text-error-500 shadow-[var(--shadow-xs)]">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-error-700">{title}</p>
        {description && <p className="max-w-sm text-sm text-error-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}
