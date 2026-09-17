"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ErrorResponse, PostDetail } from "@/lib/dto";

const POLL_INTERVAL_MS = 1750;

function isTerminalStatus(status: PostDetail["status"]): boolean {
  return status === "done" || status === "failed";
}

export type PostPollingState = {
  post: PostDetail | null;
  /** True only for the very first fetch (no post loaded yet). */
  loading: boolean;
  /** Last fetch error message, if any. A transient poll failure keeps the
   * last-known `post` around rather than blanking the screen. */
  error: string | null;
};

/**
 * Polls `GET /api/posts/[id]` on a ~1.5-2s interval (BRD 4.5) while the post
 * is in a non-terminal status, and stops permanently once it reaches `done`
 * or `failed` — a redundant poll against a finished doc would just waste a
 * request, and the doc no longer changes.
 *
 * Respects the Page Visibility API: while the tab is hidden, in-flight polls
 * are skipped entirely (no wasted network/battery on a backgrounded tab —
 * correct behavior for a real user, even though it means a headless
 * verification script that never flips `document.visibilityState` away from
 * "hidden" would need to override it to see the view advance — see
 * tasks/README.md's documented pitfall). On regaining visibility, this
 * immediately re-fetches so a user returning to an in-progress run sees
 * fresh state right away instead of waiting out a stale interval tick.
 *
 * Also handles navigate-away/return mid-run: state resets and a fresh poll
 * loop starts whenever `id` changes, and the interval/listener are torn down
 * on unmount.
 */
export function usePostPolling(id: string): PostPollingState {
  const [state, setState] = useState<PostPollingState>({
    post: null,
    loading: true,
    error: null,
  });
  const stoppedRef = useRef(false);

  const fetchOnce = useCallback(async () => {
    try {
      const res = await fetch(`/api/posts/${id}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ErrorResponse | null;
        throw new Error(body?.error?.message ?? `Request failed with status ${res.status}`);
      }
      const post = (await res.json()) as PostDetail;
      setState({ post, loading: false, error: null });
      if (isTerminalStatus(post.status)) {
        stoppedRef.current = true;
      }
    } catch (err) {
      setState((prev) => ({
        post: prev.post,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load post",
      }));
    }
  }, [id]);

  useEffect(() => {
    stoppedRef.current = false;
    setState({ post: null, loading: true, error: null });

    void fetchOnce();

    const timer = setInterval(() => {
      if (stoppedRef.current) return;
      if (document.visibilityState === "hidden") return;
      void fetchOnce();
    }, POLL_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && !stoppedRef.current) {
        void fetchOnce();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [id, fetchOnce]);

  return state;
}
