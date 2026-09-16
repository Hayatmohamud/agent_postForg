import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

const sidePosition: Record<NonNullable<TooltipProps["side"]>, string> = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
};

/**
 * CSS-only tooltip (no client JS / no hover-state hydration risk): shown via
 * `group-hover`/`focus-within` on a wrapping group, so it also appears on
 * keyboard focus of the trigger for accessibility.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-[var(--radius-sm)] bg-gray-900 px-2 py-1 text-xs text-white opacity-0 shadow-[var(--shadow-md)]",
          "transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          sidePosition[side],
        )}
      >
        {content}
      </span>
    </span>
  );
}
