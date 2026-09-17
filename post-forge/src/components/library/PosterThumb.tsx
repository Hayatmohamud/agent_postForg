import { cn } from "@/lib/cn";

export interface PosterThumbProps {
  posterImageId?: string;
  alt: string;
  className?: string;
}

/** Fallback glyph shown when a post has no poster yet (still generating, or failed before illustrate). */
function PosterPlaceholder() {
  return (
    <div
      className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-300"
      aria-hidden="true"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
        <circle cx="9" cy="10" r="1.6" />
        <path d="m5 17 4.5-4.5c.7-.7 1.8-.7 2.5 0L15 15.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Poster thumbnail via the `/api/posters/[id]` GridFS route (T06); a placeholder glyph when absent. */
export function PosterThumb({ posterImageId, alt, className }: PosterThumbProps) {
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-md)] bg-gray-100", className)}>
      {posterImageId ? (
        // eslint-disable-next-line @next/next/no-img-element -- GridFS-streamed bytes, not a static/optimizable asset
        <img
          src={`/api/posters/${posterImageId}`}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <PosterPlaceholder />
      )}
    </div>
  );
}
