"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Skeleton,
  SkeletonText,
} from "@/components/ui";
import { PostRow, PostListSkeleton } from "@/components/library";
import {
  ActivityChart,
  StageTimingsChart,
  StatusBreakdownChart,
  TokensByAgentChart,
} from "@/components/charts";
import type { PostListResponse, StatsResponse } from "@/lib/dto";
import { formatCount, formatDurationMs } from "@/lib/format";

const RECENT_POSTS_COUNT = 5;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; stats: StatsResponse; recent: PostListResponse };

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Request to ${url} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/**
 * Dashboard/home (T13): a prominent start-new-post entry, recent posts, and
 * lightweight analytics (Recharts, dataviz-skill palette) sourced from
 * `GET /api/stats` + `GET /api/posts` (T06). Shows a first-run empty state
 * when there are zero posts at all, rather than four empty charts.
 */
export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const [stats, recent] = await Promise.all([
        fetchJson<StatsResponse>("/api/stats"),
        fetchJson<PostListResponse>(`/api/posts?page=1&pageSize=${RECENT_POSTS_COUNT}`),
      ]);
      setState({ status: "ready", stats, recent });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Failed to load dashboard" });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-wide text-brand-600">Dashboard</p>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-[28px]">Good morning</h1>
        <p className="text-sm text-gray-500">
          Kick off a new post, or check how your pipeline has been performing.
        </p>
      </header>

      {state.status === "loading" && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="mt-3 h-7 w-20" />
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <SkeletonText lines={1} className="mb-4 w-32" />
                <Skeleton className="h-56 w-full" />
              </Card>
            ))}
          </div>
          <Card>
            <SkeletonText lines={1} className="mb-4 w-32" />
            <PostListSkeleton count={RECENT_POSTS_COUNT} />
          </Card>
        </div>
      )}

      {state.status === "error" && (
        <ErrorState
          title="Couldn't load the dashboard"
          description={state.message}
          action={
            <Button size="sm" variant="secondary" onClick={load}>
              Try again
            </Button>
          }
        />
      )}

      {state.status === "ready" && state.stats.totals.all === 0 && (
        <EmptyState
          title="No posts yet"
          description="Your first run takes about three minutes. Start with a topic you already know well — it makes the verification pass easy to judge."
          action={
            <Button size="sm" onClick={() => router.push("/new-post")}>
              Create your first post
            </Button>
          }
        />
      )}

      {state.status === "ready" && state.stats.totals.all > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Total posts" value={formatCount(state.stats.totals.all)} />
            <StatTile label="Done" value={formatCount(state.stats.totals.done)} />
            <StatTile label="Failed" value={formatCount(state.stats.totals.failed)} />
            <StatTile label="Avg. generation time" value={formatDurationMs(state.stats.avgGenerationTimeMs)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Posts by outcome</CardTitle>
              </CardHeader>
              <CardDescription className="mb-2">Done vs. failed vs. in progress, all-time.</CardDescription>
              <StatusBreakdownChart totals={state.stats.totals} />
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Avg. time per stage</CardTitle>
              </CardHeader>
              <CardDescription className="mb-2">Mean duration of each pipeline stage.</CardDescription>
              <StageTimingsChart avgStageTimingsMs={state.stats.avgStageTimingsMs} />
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Activity over time</CardTitle>
              </CardHeader>
              <CardDescription className="mb-2">Posts generated per day.</CardDescription>
              <ActivityChart activityByDay={state.stats.activityByDay} />
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Tokens by agent</CardTitle>
              </CardHeader>
              <CardDescription className="mb-2">Total tokens consumed per pipeline agent.</CardDescription>
              <TokensByAgentChart tokensByAgent={state.stats.tokensByAgent} />
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent posts</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => router.push("/library")}>
                View library
              </Button>
            </CardHeader>
            {state.recent.items.length === 0 ? (
              <EmptyState title="No recent posts" />
            ) : (
              <div className="space-y-3">
                {state.recent.items.map((post) => (
                  <PostRow key={post.id} post={post} />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="transition-colors duration-[var(--duration-fast)] hover:border-border-strong">
      <p className="font-mono text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1.5 text-[28px] font-semibold tracking-tight text-gray-900">{value}</p>
    </Card>
  );
}
