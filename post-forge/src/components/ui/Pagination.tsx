import { cn } from "@/lib/cn";

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Simple prev/next + numbered pagination for the Library grid/list. */
export function Pagination({ page, pageCount, onPageChange, className }: PaginationProps) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-center gap-1", className)}>
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40"
      >
        &lsaquo;
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-sm font-medium",
            p === page ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100",
          )}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-gray-500 hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40"
      >
        &rsaquo;
      </button>
    </nav>
  );
}
