"use client";

import { useRouter } from "next/navigation";
import { Button, Card, CardDescription, CardHeader, CardTitle, EmptyState, useToast } from "@/components/ui";

/**
 * Placeholder for T13 (Dashboard). Exists so the shell (T08) has a real
 * route to render, prove active-highlighting, and exercise `useToast()`
 * end-to-end. T13 replaces this content wholesale.
 */
export default function DashboardPage() {
  const { toast } = useToast();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-wide text-brand-600">Dashboard</p>
        <h1 className="text-2xl font-semibold text-gray-900">Welcome back</h1>
        <p className="text-sm text-gray-500">
          Placeholder route — T13 builds the real dashboard (recent posts, analytics). This page just
          proves the app shell persists here and that toasts work.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Toast smoke test</CardTitle>
        </CardHeader>
        <CardDescription>Confirms `useToast()` works from inside the shell.</CardDescription>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => toast({ title: "Post published", tone: "success" })}>
            Success
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              toast({ title: "Generation failed", description: "The verify stage found no sources.", tone: "error" })
            }
          >
            Error
          </Button>
          <Button size="sm" variant="ghost" onClick={() => toast({ title: "3 schedules run tonight", tone: "info" })}>
            Info
          </Button>
        </div>
      </Card>

      <EmptyState
        title="No posts yet"
        description="Generate your first post to see recent activity and analytics here."
        action={
          <Button size="sm" onClick={() => router.push("/new-post")}>
            New post
          </Button>
        }
      />
    </div>
  );
}
