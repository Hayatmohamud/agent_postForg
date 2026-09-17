/**
 * Chart color constants for T13's analytics (dataviz skill applied).
 *
 * Hardcoded hex mirrors of the CSS custom properties in `src/app/globals.css`
 * rather than `var(--color-*)` strings — SVG `fill`/`stroke` presentation
 * attributes resolving CSS custom properties is inconsistent enough across
 * export/print/screenshot paths that literal values are the safer choice for
 * a charting library, and these tokens are stable (T07 design system, locked
 * light-theme-only per CLAUDE.md).
 *
 * - Status colors (done/failed/inProgress) are the *reserved* status palette
 *   (success/error/info), never reused for series identity.
 * - Agent colors are the six fixed per-agent-stage accents already used by
 *   `components/pipeline/agents.ts` (AgentTimelineNode etc) — reusing them
 *   here keeps "research is always sky, publish is always indigo" consistent
 *   app-wide, which is more important than re-deriving a fresh categorical
 *   set. Two adjacent stages (illustrate/publish) fall below the CVD
 *   separation floor per `validate_palette.js`, so charts using this order
 *   always pair color with a direct text label (never color alone) —
 *   satisfied here because every bar sits under its own axis-label tick.
 * - Stage-timing magnitude bars use one sequential hue (brand), not per-bar
 *   identity color, per the "sequential = one hue" rule.
 */

export const STATUS_COLORS = {
  done: "#059669", // success-600
  failed: "#dc2626", // error-600
  inProgress: "#2563eb", // info-600
} as const;

export const AGENT_COLORS: Record<string, string> = {
  research: "#0284c7", // agent-research-600
  verify: "#059669", // agent-verify-600
  write: "#7c3aed", // agent-write-600
  edit: "#d97706", // agent-edit-600
  illustrate: "#c026d3", // agent-illustrate-600
  publish: "#4f46e5", // agent-publish-600
};

export const AGENT_FALLBACK_COLOR = "#71717a"; // gray-500, for an unrecognized telemetry key

export const BRAND = "#4f46e5"; // brand-600
export const BRAND_SOFT = "#e0e7ff"; // brand-100, area fill
export const GRID_COLOR = "#e4e4e7"; // gray-200
export const AXIS_TEXT_COLOR = "#71717a"; // gray-500
export const TOOLTIP_BG = "#ffffff";
export const TOOLTIP_BORDER = "#e4e4e7";

export const axisTickStyle = { fill: AXIS_TEXT_COLOR, fontSize: 12 };

export const tooltipContentStyle = {
  background: TOOLTIP_BG,
  border: `1px solid ${TOOLTIP_BORDER}`,
  borderRadius: 8,
  fontSize: 13,
  boxShadow: "0 4px 10px -2px rgb(24 24 27 / 0.08)",
};

export const tooltipLabelStyle = { color: "#18181b", fontWeight: 600 };
