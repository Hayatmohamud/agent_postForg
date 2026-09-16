import type { ReactNode } from "react";
import { Card } from "@/components/ui";

/** Single-column auth card shell shared by sign-in and sign-up. */
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
    <div className="w-full max-w-sm">
      <Card className="sm:p-7">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          <p className="mt-1.5 text-sm text-gray-500">{description}</p>
        </div>
        {children}
      </Card>
      {footer && <div className="mt-5 text-center text-sm text-gray-500">{footer}</div>}
    </div>
  );
}
