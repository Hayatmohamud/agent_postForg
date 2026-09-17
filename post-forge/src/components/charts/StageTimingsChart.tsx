"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AGENT_ORDER, AGENT_STAGES } from "@/components/pipeline";
import type { StatsResponse } from "@/lib/dto";
import { formatDurationMs } from "@/lib/format";
import { ChartEmpty } from "./ChartEmpty";
import { axisTickStyle, BRAND, GRID_COLOR, tooltipContentStyle, tooltipLabelStyle } from "./theme";

export interface StageTimingsChartProps {
  avgStageTimingsMs: StatsResponse["avgStageTimingsMs"] | undefined;
  height?: number;
}

/**
 * Average time spent per pipeline stage — a magnitude comparison across a
 * fixed, ordered set of categories, so per the dataviz skill it gets one
 * sequential hue (brand) rather than per-bar identity color; the stage
 * order/labels are read off `AGENT_ORDER`/`AGENT_STAGES` (T07) rather than
 * re-derived, so it always matches the pipeline shown elsewhere in the app.
 */
export function StageTimingsChart({ avgStageTimingsMs, height = 240 }: StageTimingsChartProps) {
  const data = AGENT_ORDER.map((key) => ({
    key,
    label: AGENT_STAGES[key].label,
    ms: avgStageTimingsMs?.[key] ?? 0,
  }));

  const allZero = data.every((d) => d.ms === 0);
  if (allZero) return <ChartEmpty label="No stage timing data yet" height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={axisTickStyle} axisLine={false} tickLine={false} />
        <YAxis
          tick={axisTickStyle}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatDurationMs(v)}
          width={56}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value: number) => [formatDurationMs(value), "Avg time"]}
          cursor={{ fill: "rgba(0,0,0,0.03)" }}
        />
        <Bar dataKey="ms" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
