"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StatsResponse } from "@/lib/dto";
import { ChartEmpty } from "./ChartEmpty";
import { axisTickStyle, STATUS_COLORS, tooltipContentStyle, tooltipLabelStyle } from "./theme";

export interface StatusBreakdownChartProps {
  totals: StatsResponse["totals"];
  height?: number;
}

/**
 * Total posts by outcome (done / failed / in progress) — a state/status
 * comparison, so it uses the reserved status palette (never the categorical
 * agent palette) and a single labeled axis, per the dataviz skill's
 * "status colors are reserved" rule.
 */
export function StatusBreakdownChart({ totals, height = 220 }: StatusBreakdownChartProps) {
  const data = [
    { key: "done", label: "Done", value: totals?.done ?? 0, color: STATUS_COLORS.done },
    { key: "failed", label: "Failed", value: totals?.failed ?? 0, color: STATUS_COLORS.failed },
    {
      key: "inProgress",
      label: "In progress",
      value: totals?.inProgress ?? 0,
      color: STATUS_COLORS.inProgress,
    },
  ];

  const allZero = data.every((d) => d.value === 0);
  if (allZero) return <ChartEmpty label="No posts yet" height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
        <XAxis type="number" allowDecimals={false} tick={axisTickStyle} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          width={80}
          tick={axisTickStyle}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value) => [String(value), "Posts"] as [string, string]}
          cursor={{ fill: "rgba(0,0,0,0.03)" }}
        />
        <Bar dataKey="value" radius={[4, 4, 4, 4]} maxBarSize={28}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
