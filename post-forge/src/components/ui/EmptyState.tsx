import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Reusable empty/zero-data block (first-run dashboard, empty library, no schedules, 404, etc). */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-xl)] border border-dashed border-border-strong bg-gray-50 px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-full)] bg-white text-gray-400 shadow-[var(--shadow-xs)]">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {description && <p className="max-w-sm text-sm text-gray-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
