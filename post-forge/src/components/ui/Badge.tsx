import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "error"
  | "info";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: ReactNode;
}

const tones: Record<BadgeTone, string> = {
  neutral: "bg-gray-100 text-gray-700",
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  error: "bg-error-50 text-error-700",
  info: "bg-info-50 text-info-700",
};

/** Generic pill/badge — used standalone or as the base for StatusBadge/VerifiedBadge below. */
export function Badge({ className, tone = "neutral", icon, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--radius-full)] px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

/** Pipeline run status, per PLAN.md's `posts.status` union. */
export type RunStatus =
  | "researching"
  | "verifying"
  | "writing"
  | "editing"
  | "illustrating"
  | "publishing"
  | "done"
  | "failed";

const statusMeta: Record<RunStatus, { label: string; tone: BadgeTone }> = {
  researching: { label: "Researching", tone: "info" },
  verifying: { label: "Verifying", tone: "info" },
  writing: { label: "Writing", tone: "brand" },
  editing: { label: "Editing", tone: "brand" },
  illustrating: { label: "Illustrating", tone: "brand" },
  publishing: { label: "Publishing", tone: "brand" },
  done: { label: "Done", tone: "success" },
  failed: { label: "Failed", tone: "error" },
};

export function StatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const meta = statusMeta[status];
  const isActive = !["done", "failed"].includes(status);
  return (
    <Badge tone={meta.tone} className={className}>
      {isActive && (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" aria-hidden="true" />
      )}
      {meta.label}
    </Badge>
  );
}

/** Verified / unverified claim or source indicator (DESIGN_PROMPT.md screen 7). */
export function VerifiedBadge({ verified, className }: { verified: boolean; className?: string }) {
  return (
    <Badge tone={verified ? "success" : "warning"} className={className}>
      {verified ? (
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M5 10.5 8.5 14 15 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 6v5m0 3h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {verified ? "Verified" : "Unverified"}
    </Badge>
  );
}
