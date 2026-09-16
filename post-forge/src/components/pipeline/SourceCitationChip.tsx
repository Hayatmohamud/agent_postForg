import { cn } from "@/lib/cn";

export interface SourceCitationChipProps {
  title: string;
  url: string;
  verified?: boolean;
  className?: string;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * A single cited source — title + domain, clickable (opens in a new tab),
 * with a verified/unverified indicator dot. Used in the Post detail Sources
 * section (DESIGN_PROMPT.md screen 7) and the Verify stage's live detail
 * panel (screen 6). Exported for T11/T12 to reuse verbatim.
 */
export function SourceCitationChip({ title, url, verified, className }: SourceCitationChipProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex max-w-full items-center gap-2 rounded-[var(--radius-lg)] border border-border bg-white px-3 py-2 text-sm shadow-[var(--shadow-xs)]",
        "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:border-brand-300 hover:bg-brand-50",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-2 w-2 shrink-0 rounded-full",
          verified === undefined ? "bg-gray-300" : verified ? "bg-success-500" : "bg-warning-500",
        )}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-gray-800 group-hover:text-brand-800">{title}</span>
        <span className="block truncate font-mono text-xs text-gray-400">{domainOf(url)}</span>
      </span>
      {verified !== undefined && (
        <span
          className={cn(
            "shrink-0 text-xs font-medium",
            verified ? "text-success-600" : "text-warning-600",
          )}
        >
          {verified ? "Verified" : "Unverified"}
        </span>
      )}
    </a>
  );
}
