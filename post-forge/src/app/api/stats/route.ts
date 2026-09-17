/**
 * `GET /api/stats` (T06 BRD 4.5): dashboard analytics. Deliberately a
 * simple in-JS aggregation over every `posts` document rather than a Mongo
 * aggregation pipeline — an acceptable, deliberate simplification at this
 * project's scale (per the BRD's own note), not an oversight.
 *
 * Figures returned:
 * - `totals`: all / done / failed / in-progress (anything not done/failed)
 *   counts.
 * - `avgGenerationTimeMs`: mean `updatedAt - createdAt` across `done` posts
 *   only (the wall-clock time a completed run actually took).
 * - `avgStageTimingsMs`: mean per-stage duration from `telemetry.timingsByStage`,
 *   averaged only over posts that recorded a nonzero value for that stage.
 * - `tokensByAgent`: summed `telemetry.tokensByAgent` across every post.
 * - `activityByDay`: a day-bucketed count of posts *created* that day
 *   (token/agent activity over time), sorted ascending by date.
 */

import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongo";
import type { StatsResponse, TimeSeriesPoint } from "@/lib/dto";
import { STAGES, type Post, type Stage } from "@/lib/state";
import { errorResponse } from "@/lib/http";

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const db = await getDb();
    const posts = await db.collection<Post>("posts").find({}).toArray();

    const totals = {
      all: posts.length,
      done: 0,
      failed: 0,
      inProgress: 0,
    };

    let generationTimeSum = 0;
    let generationTimeCount = 0;

    const stageTimingSums: Record<Stage, number> = Object.fromEntries(
      STAGES.map((s) => [s, 0])
    ) as Record<Stage, number>;
    const stageTimingCounts: Record<Stage, number> = Object.fromEntries(
      STAGES.map((s) => [s, 0])
    ) as Record<Stage, number>;

    const tokensByAgent: Record<string, number> = {};
    const activityByDayMap = new Map<string, number>();

    for (const post of posts) {
      if (post.status === "done") {
        totals.done += 1;
        const ms = post.updatedAt.getTime() - post.createdAt.getTime();
        if (Number.isFinite(ms) && ms >= 0) {
          generationTimeSum += ms;
          generationTimeCount += 1;
        }
      } else if (post.status === "failed") {
        totals.failed += 1;
      } else {
        totals.inProgress += 1;
      }

      for (const stage of STAGES) {
        const ms = post.telemetry?.timingsByStage?.[stage];
        if (typeof ms === "number" && ms > 0) {
          stageTimingSums[stage] += ms;
          stageTimingCounts[stage] += 1;
        }
      }

      for (const [agent, tokens] of Object.entries(post.telemetry?.tokensByAgent ?? {})) {
        tokensByAgent[agent] = (tokensByAgent[agent] ?? 0) + tokens;
      }

      const key = dayKey(post.createdAt);
      activityByDayMap.set(key, (activityByDayMap.get(key) ?? 0) + 1);
    }

    const avgStageTimingsMs: Record<Stage, number> = Object.fromEntries(
      STAGES.map((stage) => [
        stage,
        stageTimingCounts[stage] > 0
          ? Math.round(stageTimingSums[stage] / stageTimingCounts[stage])
          : 0,
      ])
    ) as Record<Stage, number>;

    const activityByDay: TimeSeriesPoint[] = Array.from(activityByDayMap.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const response: StatsResponse = {
      totals,
      avgGenerationTimeMs:
        generationTimeCount > 0 ? Math.round(generationTimeSum / generationTimeCount) : null,
      avgStageTimingsMs,
      tokensByAgent,
      activityByDay,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to compute stats";
    return errorResponse(500, message, "stats_failed");
  }
}
