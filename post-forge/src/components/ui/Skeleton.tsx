import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

/**
 * Shimmer skeleton block. The shimmer animation is defined once in
 * globals.css (`--animate-shimmer`) and is neutralized globally under
 * `prefers-reduced-motion: reduce`.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-[var(--radius-md)] bg-[linear-gradient(90deg,var(--color-gray-100)_25%,var(--color-gray-200)_37%,var(--color-gray-100)_63%)] bg-[length:200%_100%]",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

/** Convenience: a stack of skeleton lines, e.g. for a loading card body. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}
