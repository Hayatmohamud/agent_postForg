import Link from "next/link";
import { EmptyState } from "@/components/ui";

/**
 * Root `not-found.tsx` — handles both an explicit `notFound()` call in any
 * segment and any unmatched URL app-wide (see Next's file-convention docs:
 * the root `app/not-found` is the catch-all for unrouted paths). Renders a
 * Server Component (no client state needed) so it stays cheap.
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <EmptyState
          title="Page not found"
          description="The page you're looking for doesn't exist or may have been moved."
          action={
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-brand-600 px-4 text-sm font-medium text-white shadow-[var(--shadow-xs)] transition-colors duration-[var(--duration-fast)] hover:bg-brand-700"
            >
              Back to dashboard
            </Link>
          }
        />
      </div>
    </main>
  );
}
