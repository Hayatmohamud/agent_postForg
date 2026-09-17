/**
 * Small formatting helpers shared by the dashboard (T13) and library (T13)
 * screens — kept dependency-free (no date/number library) since the needs
 * here are narrow: relative timestamps, durations, and compact counts.
 */

/** Formats a millisecond duration as e.g. "1h 4m", "3m 12s", "820ms". Resilient to null/undefined/0. */
export function formatDurationMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Formats an ISO date string as a short absolute date, e.g. "Sep 17, 2026". */
export function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Formats an ISO date string as a relative time, e.g. "2h ago", "just now", falling back to a short date beyond a week. */
export function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  if (diffSeconds < 60) return "just now";

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return formatDate(iso);
}

/** Formats an integer with locale-aware thousands separators (e.g. 12000 -> "12,000"). */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "0";
  return n.toLocaleString();
}

/** Capitalizes an agent/stage key like "research" -> "Research" as a label fallback. */
export function titleCase(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}
