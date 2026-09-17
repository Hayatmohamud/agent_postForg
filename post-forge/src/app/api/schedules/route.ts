/**
 * `GET/POST /api/schedules` (T14 BRD 4.2): list all schedules, or create a
 * new one. Matches T06's route conventions (thin handler + `errorResponse`/
 * `zodErrorMessage` from `@/lib/http`, `{error:{message,code?}}` on failure).
 */

import { NextResponse, type NextRequest } from "next/server";
import { ZodError, z } from "zod";
import {
  createSchedule,
  listSchedules,
  type Schedule,
} from "@/lib/schedules-repo";
import { errorResponse, zodErrorMessage } from "@/lib/http";
import { toScheduleDTO, type ScheduleDTO } from "./dto";

const createScheduleSchema = z.object({
  topic: z.string().trim().min(1, "topic is required"),
  cadence: z.enum(["daily", "weekly"]),
  enabled: z.boolean().optional(),
});

export type ScheduleListResponse = { items: ScheduleDTO[] };

export async function GET() {
  try {
    const items: Schedule[] = await listSchedules();
    const response: ScheduleListResponse = { items: items.map(toScheduleDTO) };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list schedules";
    return errorResponse(500, message, "list_schedules_failed");
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, "Request body must be valid JSON", "invalid_json");
  }

  let input: z.infer<typeof createScheduleSchema>;
  try {
    input = createScheduleSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(400, zodErrorMessage(err), "invalid_request");
    }
    throw err;
  }

  try {
    const schedule = await createSchedule(input);
    const response: ScheduleDTO = toScheduleDTO(schedule);
    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create schedule";
    return errorResponse(500, message, "create_schedule_failed");
  }
}
