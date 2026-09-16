"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorState } from "@/components/ui";

/**
 * Segment-level error boundary for every authed route. Per Next's component
 * hierarchy, `error.tsx` wraps `page.tsx`/nested `layout.tsx` but NOT the
 * `layout.tsx` in the same segment — so the shell (sidebar/topbar) in
 * `./layout.tsx` stays mounted and only the content area shows this
 * friendly failure message. Covers both unexpected render errors and
 * agent-pipeline/generation failures thrown by a data screen.
 */
export default function AppSegmentError({
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
    <div className="flex flex-1 items-center justify-center py-12">
      <ErrorState
        title="Something went wrong"
        description="This screen hit an unexpected error (or an agent run failed mid-pipeline). You can try again, or head back to the dashboard."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => retry()}>Try again</Button>
            <Button variant="secondary" onClick={() => router.push("/dashboard")}>
              Back to dashboard
            </Button>
          </div>
        }
      />
    </div>
  );
}
