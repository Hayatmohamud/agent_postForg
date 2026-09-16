"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorState } from "@/components/ui";
import { fontVariables } from "@/lib/fonts";

/**
 * Root error boundary — catches anything not already handled by a nested
 * `error.tsx` (e.g. an error thrown above the `(app)` route group, or on the
 * public/marketing routes). Renders on-brand rather than Next's default
 * unstyled fallback. Must be a Client Component (error boundaries always
 * are); root `error.tsx` renders *inside* the root layout, so `globals.css`
 * and the font variables are already on `<html>` — no need to redeclare
 * them here (unlike `global-error.tsx`, which would need its own
 * `<html>`/`<body>`).
 */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={`flex flex-1 items-center justify-center px-4 py-16 ${fontVariables}`}>
      <div className="w-full max-w-md">
        <ErrorState
          title="Something went wrong"
          description="An unexpected error stopped this page from loading. Try again, or head back home."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button onClick={() => retry()}>Try again</Button>
              <Button variant="secondary" onClick={() => router.push("/")}>
                Go home
              </Button>
            </div>
          }
        />
      </div>
    </main>
  );
}
