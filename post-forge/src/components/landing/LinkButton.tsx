import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type LinkButtonVariant = "primary" | "secondary" | "ghost";
export type LinkButtonSize = "sm" | "md" | "lg";

const variants: Record<LinkButtonVariant, string> = {
  primary: "bg-brand-600 text-white shadow-[var(--shadow-xs)] hover:bg-brand-700 active:bg-brand-800",
  secondary:
    "bg-white text-gray-900 border border-border-strong shadow-[var(--shadow-xs)] hover:bg-gray-50 active:bg-gray-100",
  ghost: "bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200",
};

const sizes: Record<LinkButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

/**
 * Anchor styled to match `@/components/ui/Button` exactly (same tokens,
 * sizes, variants) for CTAs that must be real navigation links (`<a>`),
 * not a `<button>` nested inside one — nesting interactive controls (a
 * `<button>` inside an `<a>`) is invalid HTML and would fail the WCAG AA /
 * keyboard-navigability bar this task is held to. Landing-only; not part of
 * the T07 design system barrel.
 */
export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  children,
}: {
  href: string;
  variant?: LinkButtonVariant;
  size?: LinkButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium select-none",
        "rounded-[var(--radius-md)] transition-colors transition-shadow",
        "duration-[var(--duration-fast)] ease-[var(--ease-standard)]",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
    >
      {children}
    </Link>
  );
}
