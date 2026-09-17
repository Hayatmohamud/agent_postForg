/**
 * Small schedules-only DTO helper, kept local to `api/schedules/**` (T14
 * owns this file exclusively) rather than added to the shared
 * `src/lib/dto.ts` (T06), to avoid touching a file another wave's task may
 * also depend on. Same ISO-date-string convention `dto.ts` uses elsewhere.
 */

import type { Cadence, Schedule, ScheduleLastResult } from "@/lib/schedules-repo";

export type ScheduleLastResultDTO = {
  status: ScheduleLastResult["status"];
  at: string;
  postId?: string;
};

export type ScheduleDTO = {
  id: string;
  topic: string;
  cadence: Cadence;
  enabled: boolean;
  nextRunAt: string;
  lastResult?: ScheduleLastResultDTO;
  createdAt: string;
  updatedAt: string;
};

export function toScheduleDTO(schedule: Schedule): ScheduleDTO {
  return {
    id: schedule._id.toString(),
    topic: schedule.topic,
    cadence: schedule.cadence,
    enabled: schedule.enabled,
    nextRunAt: schedule.nextRunAt.toISOString(),
    lastResult: schedule.lastResult
      ? {
          status: schedule.lastResult.status,
          at: schedule.lastResult.at.toISOString(),
          postId: schedule.lastResult.postId,
        }
      : undefined,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}
