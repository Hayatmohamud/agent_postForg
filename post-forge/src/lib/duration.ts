/**
 * Elapsed-time formatting shared by the pipeline showcase (T11): per-stage
 * and overall timers are always anchored on server timestamps (`StageState`
 * / `Post.createdAt`/`updatedAt`, ISO strings in the `PostDetail` DTO), never
 * on when the client happened to mount — only the "now" side of an
 * in-progress interval may come from the client clock.
 */

/** Formats a millisecond duration as "0s" / "42s" / "1m 05s" / "12m 03s". */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

/**
 * Elapsed time for a single stage: `endedAt - startedAt` once both server
 * timestamps exist, `now - startedAt` while still running, or `undefined`
 * before the stage has started.
 */
export function stageElapsedMs(
  startedAt: string | undefined,
  endedAt: string | undefined,
  now: number,
): number | undefined {
  if (!startedAt) return undefined;
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : now;
  return Math.max(0, end - start);
}
