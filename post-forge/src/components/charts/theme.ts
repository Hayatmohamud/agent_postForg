"use client";

import { useTheme } from "@/hooks/useTheme";

/**
 * Chart color constants for T13's analytics (dataviz skill applied),
 * updated for the redesign's green brand + real dark mode.
 *
 * Hardcoded hex mirrors of the CSS custom properties in `src/app/globals.css`
 * rather than `var(--color-*)` strings — SVG `fill`/`stroke` presentation
 * attributes resolving CSS custom properties is inconsistent enough across
 * export/print/screenshot paths that literal values are the safer choice for
 * a charting library. Because dark mode is now real (not locked
 * light-only), this file exports one palette per theme plus a
 * `useChartColors()` hook that picks the active one — chart components call
 * the hook instead of importing the constants directly.
 *
 * - Status colors (done/failed/inProgress) are the *reserved* status palette
 *   (success/error/info), never reused for series identity.
 * - Agent colors are the six fixed per-agent-stage accents already used by
 *   `components/pipeline/agents.ts` (AgentTimelineNode etc) — reusing them
 *   here keeps "research is always blue, verify is always green" consistent
 *   app-wide, which is more important than re-deriving a fresh categorical
 *   set. Every bar sits under its own axis-label tick, so color is never the
 *   only signal (CVD-safe).
 * - Stage-timing magnitude bars use one sequential hue (brand), not per-bar
 *   identity color, per the "sequential = one hue" rule.
 */

interface ChartPalette {
  statusColors: { done: string; failed: string; inProgress: string };
  agentColors: Record<string, string>;
  agentFallbackColor: string;
  brand: string;
  brandSoft: string;
  gridColor: string;
  axisTextColor: string;
  tooltipBg: string;
  tooltipBorder: string;
  cursorFill: string;
}

const light: ChartPalette = {
  statusColors: {
    done: "#1f9d6b", // success/brand-600
    failed: "#dc2626", // error-600
    inProgress: "#4f6bea", // info-600
  },
  agentColors: {
    research: "#4f6bea", // agent-research-600
    verify: "#1f9d6b", // agent-verify-600 (= brand)
    write: "#7c3aed", // agent-write-600
    edit: "#d97706", // agent-edit-600
    illustrate: "#c026d3", // agent-illustrate-600
    publish: "#3266d6", // agent-publish-600
  },
  agentFallbackColor: "#6f7973", // gray-500
  brand: "#1f9d6b", // brand-600
  brandSoft: "#cdeee0", // brand-100
  gridColor: "#e5eae7", // gray-200
  axisTextColor: "#6f7973", // gray-500
  tooltipBg: "#ffffff", // surface
  tooltipBorder: "#e5eae7", // gray-200
  cursorFill: "rgba(11,18,16,0.04)",
};

const dark: ChartPalette = {
  statusColors: {
    done: "#4ad999",
    failed: "#f0705c",
    inProgress: "#8fa3f5",
  },
  agentColors: {
    research: "#8fa3f5",
    verify: "#4ad999",
    write: "#b18af5",
    edit: "#f0b35c",
    illustrate: "#f27fe0",
    publish: "#6f97ea",
  },
  agentFallbackColor: "#7d8a85",
  brand: "#4ad999",
  brandSoft: "#4ad999",
  gridColor: "#1e2724",
  axisTextColor: "#7d8a85",
  tooltipBg: "#101614",
  tooltipBorder: "#1e2724",
  cursorFill: "rgba(255,255,255,0.06)",
};

export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const palette = resolvedTheme === "dark" ? dark : light;

  return {
    ...palette,
    axisTickStyle: { fill: palette.axisTextColor, fontSize: 12 },
    tooltipContentStyle: {
      background: palette.tooltipBg,
      border: `1px solid ${palette.tooltipBorder}`,
      borderRadius: 8,
      fontSize: 13,
      boxShadow:
        resolvedTheme === "dark"
          ? "0 4px 10px -2px rgb(0 0 0 / 0.3)"
          : "0 4px 10px -2px rgb(11 18 16 / 0.08)",
    },
    tooltipLabelStyle: {
      color: resolvedTheme === "dark" ? "#eef3f0" : "#0b1210",
      fontWeight: 600,
    },
  };
}
