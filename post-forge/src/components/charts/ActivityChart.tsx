"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TimeSeriesPoint } from "@/lib/dto";
import { ChartEmpty } from "./ChartEmpty";
import { axisTickStyle, BRAND, BRAND_SOFT, GRID_COLOR, tooltipContentStyle, tooltipLabelStyle } from "./theme";

export interface ActivityChartProps {
  activityByDay: TimeSeriesPoint[] | undefined;
  height?: number;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Posts generated per day, change-over-time — a single series so it gets
 * one hue (brand) with a soft area fill, an axis-anchored tooltip
 * (recharts' "axis" tooltip mode, the default for AreaChart), and no legend
 * (a lone series is named by the chart title, per the skill's legend rule).
 */
export function ActivityChart({ activityByDay, height = 240 }: ActivityChartProps) {
  const data = activityByDay ?? [];
  if (data.length === 0) return <ChartEmpty label="No activity yet" height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND_SOFT} stopOpacity={0.9} />
            <stop offset="100%" stopColor={BRAND_SOFT} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDate}
          tick={axisTickStyle}
          axisLine={false}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis allowDecimals={false} tick={axisTickStyle} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          labelFormatter={(label) => shortDate(String(label))}
          formatter={(value) => [String(value), "Posts"] as [string, string]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={BRAND}
          strokeWidth={2}
          fill="url(#activityFill)"
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
