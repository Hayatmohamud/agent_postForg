/**
 * `GET/PATCH/DELETE /api/schedules/[id]` (T14 BRD 4.2): read/update/delete
 * one schedule. `PATCH` accepts any subset of the editable fields
 * (`topic`, `cadence`, `enabled`, `nextRunAt`) — enable/disable is just
 * `PATCH {enabled}`.
 */

import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { ZodError, z } from "zod";
import {
  deleteSchedule,
  getScheduleById,
  updateSchedule,
} from "@/lib/schedules-repo";
import { errorResponse, zodErrorMessage } from "@/lib/http";
import { toScheduleDTO, type ScheduleDTO } from "../dto";

type RouteContext = { params: Promise<{ id: string }> };

const updateScheduleSchema = z.object({
  topic: z.string().trim().min(1, "topic is required").optional(),
  cadence: z.enum(["daily", "weekly"]).optional(),
  enabled: z.boolean().optional(),
  nextRunAt: z.coerce.date().optional(),
});

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return errorResponse(400, `"${id}" is not a valid schedule id`, "invalid_id");
  }

  try {
    const schedule = await getScheduleById(id);
    if (!schedule) {
      return errorResponse(404, `No schedule found with id "${id}"`, "not_found");
    }
    const response: ScheduleDTO = toScheduleDTO(schedule);
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch schedule";
    return errorResponse(500, message, "get_schedule_failed");
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return errorResponse(400, `"${id}" is not a valid schedule id`, "invalid_id");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Request body must be valid JSON", "invalid_json");
  }

  let patch: z.infer<typeof updateScheduleSchema>;
  try {
    patch = updateScheduleSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(400, zodErrorMessage(err), "invalid_request");
    }
    throw err;
  }

  if (Object.keys(patch).length === 0) {
    return errorResponse(400, "At least one field must be provided", "empty_patch");
  }

  try {
    const updated = await updateSchedule(id, patch);
    if (!updated) {
      return errorResponse(404, `No schedule found with id "${id}"`, "not_found");
    }
    const response: ScheduleDTO = toScheduleDTO(updated);
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update schedule";
    return errorResponse(500, message, "update_schedule_failed");
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return errorResponse(400, `"${id}" is not a valid schedule id`, "invalid_id");
  }

  try {
    const deleted = await deleteSchedule(id);
    if (!deleted) {
      return errorResponse(404, `No schedule found with id "${id}"`, "not_found");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete schedule";
    return errorResponse(500, message, "delete_schedule_failed");
  }
}
