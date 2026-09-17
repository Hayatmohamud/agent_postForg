/**
 * `POST /api/schedules/[id]/run-now` (T14 BRD 4.2/4.5): manually fires a
 * schedule immediately, outside its normal cadence. Reuses
 * `createGenerationRun` (T06) directly — the exact same doc-creation +
 * `post/generate.requested` event-emission path `POST /api/generate` and
 * the cron function (`src/inngest/cron.ts`) both use — so a manual run
 * produces a normal post that shows up in the library, per the BRD's
 * acceptance criteria.
 *
 * Does NOT advance `nextRunAt` (a manual run-now is an extra, out-of-band
 * run, not a substitute for the next scheduled cadence tick) but DOES
 * record `lastResult` so the list reflects the most recent activity.
 */

import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { createGenerationRun } from "@/app/api/generate/core";
import { getScheduleById, setLastResult } from "@/lib/schedules-repo";
import { errorResponse } from "@/lib/http";
import { toScheduleDTO, type ScheduleDTO } from "../../dto";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return errorResponse(400, `"${id}" is not a valid schedule id`, "invalid_id");
  }

  try {
    const schedule = await getScheduleById(id);
    if (!schedule) {
      return errorResponse(404, `No schedule found with id "${id}"`, "not_found");
    }

    const at = new Date();
    let lastResult: { status: "success" | "failure"; at: Date; postId?: string };
    try {
      const run = await createGenerationRun({ topic: schedule.topic });
      lastResult = { status: "success", at, postId: run.id };
    } catch (err) {
      lastResult = { status: "failure", at };
      // Still record the failed attempt, then surface the error.
      await setLastResult(schedule._id, lastResult);
      const message = err instanceof Error ? err.message : "Failed to launch run";
      return errorResponse(500, message, "run_now_failed");
    }

    await setLastResult(schedule._id, lastResult);

    const updated = await getScheduleById(id);
    const response: { schedule: ScheduleDTO; postId: string } = {
      schedule: toScheduleDTO(updated ?? { ...schedule, lastResult }),
      postId: lastResult.postId!,
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to run schedule now";
    return errorResponse(500, message, "run_now_failed");
  }
}
