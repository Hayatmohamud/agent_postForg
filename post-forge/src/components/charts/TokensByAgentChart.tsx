"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AGENT_ORDER, AGENT_STAGES } from "@/components/pipeline";
import type { StatsResponse } from "@/lib/dto";
import { formatCount, titleCase } from "@/lib/format";
import { ChartEmpty } from "./ChartEmpty";
import { AGENT_COLORS, AGENT_FALLBACK_COLOR, axisTickStyle, GRID_COLOR, tooltipContentStyle, tooltipLabelStyle } from "./theme";

export interface TokensByAgentChartProps {
  tokensByAgent: StatsResponse["tokensByAgent"] | undefined;
  height?: number;
}

/**
 * Token usage per agent — identity across a fixed, known set of agents, so
 * it reuses the app's six per-agent-stage accent colors (`components/
 * pipeline/agents.ts`) in their canonical order. Any telemetry key outside
 * the known six (future agent, typo, etc.) still renders, in gray, appended
 * at the end, rather than being dropped — telemetry-resilience per the BRD.
 */
export function TokensByAgentChart({ tokensByAgent, height = 240 }: TokensByAgentChartProps) {
  const known = new Set(AGENT_ORDER as string[]);
  const tokens = tokensByAgent ?? {};

  const data = [
    ...AGENT_ORDER.map((key) => ({
      key,
      label: AGENT_STAGES[key].label,
      tokens: tokens[key] ?? 0,
      color: AGENT_COLORS[key],
    })),
    ...Object.keys(tokens)
      .filter((key) => !known.has(key))
      .map((key) => ({ key, label: titleCase(key), tokens: tokens[key], color: AGENT_FALLBACK_COLOR })),
  ];

  const allZero = data.every((d) => d.tokens === 0);
  if (allZero) return <ChartEmpty label="No token usage recorded yet" height={height} />;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={axisTickStyle} axisLine={false} tickLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={axisTickStyle} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          contentStyle={tooltipContentStyle}
          labelStyle={tooltipLabelStyle}
          formatter={(value) => [formatCount(Number(value)), "Tokens"] as [string, string]}
          cursor={{ fill: "rgba(0,0,0,0.03)" }}
        />
        <Bar dataKey="tokens" radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
