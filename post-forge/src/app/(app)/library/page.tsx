"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterGroup,
  Input,
  Pagination,
} from "@/components/ui";
import { PostCard, PostGridSkeleton, PostListSkeleton, PostRow } from "@/components/library";
import type { PostListResponse } from "@/lib/dto";

const PAGE_SIZE = 12;

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "done", label: "Done" },
  { value: "failed", label: "Failed" },
  { value: "researching", label: "Researching" },
  { value: "verifying", label: "Verifying" },
  { value: "writing", label: "Writing" },
  { value: "editing", label: "Editing" },
  { value: "illustrating", label: "Illustrating" },
  { value: "publishing", label: "Publishing" },
];

type ViewMode = "grid" | "list";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: PostListResponse };

function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M4 5h12M4 10h12M4 15h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

async function fetchPosts(params: URLSearchParams): Promise<PostListResponse> {
  const res = await fetch(`/api/posts?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to load posts (${res.status})`);
  }
  return res.json();
}

function LibraryInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>("grid");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // Debounce the topic search so every keystroke doesn't fire a request.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Any filter change resets to page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, from, to]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (status !== "all") params.set("status", status);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));
    return params;
  }, [debouncedSearch, status, from, to, page]);

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const data = await fetchPosts(queryParams);
      setState({ status: "ready", data });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Failed to load posts" });
    }
  }, [queryParams]);

  useEffect(() => {
    load();
  }, [load]);

  const hasActiveFilters = Boolean(debouncedSearch.trim() || status !== "all" || from || to);
  const pageCount = state.status === "ready" ? Math.max(1, Math.ceil(state.data.total / PAGE_SIZE)) : 1;

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setFrom("");
    setTo("");
    router.replace("/library");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-wide text-brand-600">Library</p>
        <h1 className="text-2xl font-semibold text-gray-900">Your posts</h1>
        <p className="text-sm text-gray-500">Search, filter, and browse every post you&apos;ve generated.</p>
      </header>

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <Input
            label="Search topic"
            placeholder="Search by topic or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 rounded-[var(--radius-md)] border border-border-strong bg-white px-3 text-sm text-gray-900 shadow-[var(--shadow-xs)]"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 rounded-[var(--radius-md)] border border-border-strong bg-white px-3 text-sm text-gray-900 shadow-[var(--shadow-xs)]"
              />
            </label>
            <div
              role="group"
              aria-label="View"
              className="flex h-10 items-center gap-0.5 rounded-[var(--radius-md)] border border-border-strong bg-white p-0.5"
            >
              <button
                type="button"
                aria-pressed={view === "grid"}
                aria-label="Grid view"
                onClick={() => setView("grid")}
                className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] ${
                  view === "grid" ? "bg-brand-600 text-white" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                <GridIcon />
              </button>
              <button
                type="button"
                aria-pressed={view === "list"}
                aria-label="List view"
                onClick={() => setView("list")}
                className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] ${
                  view === "list" ? "bg-brand-600 text-white" : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                <ListIcon />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterGroup label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {state.status === "loading" &&
        (view === "grid" ? <PostGridSkeleton count={PAGE_SIZE} /> : <PostListSkeleton count={8} />)}

      {state.status === "error" && (
        <ErrorState
          title="Couldn't load your posts"
          description={state.message}
          action={
            <Button size="sm" variant="secondary" onClick={load}>
              Try again
            </Button>
          }
        />
      )}

      {state.status === "ready" && state.data.items.length === 0 && (
        <EmptyState
          title={hasActiveFilters ? "No posts match your filters" : "No posts yet"}
          description={
            hasActiveFilters
              ? "Try a different search term, status, or date range."
              : "Posts you generate will show up here."
          }
          action={
            hasActiveFilters ? (
              <Button size="sm" variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : (
              <Button size="sm" onClick={() => router.push("/new-post")}>
                New post
              </Button>
            )
          }
        />
      )}

      {state.status === "ready" && state.data.items.length > 0 && (
        <>
          {view === "grid" ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {state.data.items.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {state.data.items.map((post) => (
                <PostRow key={post.id} post={post} />
              ))}
            </div>
          )}

          <Pagination page={state.data.page} pageCount={pageCount} onPageChange={setPage} className="pt-2" />
        </>
      )}
    </div>
  );
}

/**
 * Library (T13): searchable/filterable grid + list of past posts, wired to
 * `GET /api/posts` (T06) — search/status/date filters and pagination.
 * Wrapped in Suspense because `useSearchParams` (for the topbar's `?q=`
 * hand-off, T08) requires it in the App Router.
 */
export default function LibraryPage() {
  return (
    <Suspense fallback={<PostGridSkeleton />}>
      <LibraryInner />
    </Suspense>
  );
}
