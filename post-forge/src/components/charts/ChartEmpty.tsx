/** Muted placeholder shown in a chart's slot when its underlying series has no data yet. */
export function ChartEmpty({ label = "No data yet", height = 220 }: { label?: string; height?: number }) {
  return (
    <div
      className="flex items-center justify-center text-sm text-gray-400"
      style={{ height }}
      role="status"
    >
      {label}
    </div>
  );
}
