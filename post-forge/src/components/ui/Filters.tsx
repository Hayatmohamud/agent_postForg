import { cn } from "@/lib/cn";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterGroupProps {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** A row of togglable filter chips, e.g. Library's status/date filters. */
export function FilterGroup({ label, options, value, onChange, className }: FilterGroupProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-[var(--radius-full)] border px-3 py-1 text-sm font-medium transition-colors duration-[var(--duration-fast)]",
              active
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-border-strong bg-white text-gray-600 hover:border-gray-400",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
