import type { ReactNode } from "react";

/**
 * Auth form shell shared by sign-in / sign-up / the sign-in page's inline
 * "forgot password" state. No card border/shadow — the two-column
 * `(auth)/layout.tsx` already frames the form against the page background,
 * matching the imported design (a plain left column, not a floating card).
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full">
      <h1 className="text-[27px] font-semibold tracking-tight text-text">{title}</h1>
      <p className="mt-1.5 text-[15px] text-gray-500">{description}</p>
      <div className="mt-7">{children}</div>
      {footer && <div className="mt-5 text-sm text-gray-500">{footer}</div>}
    </div>
  );
}
