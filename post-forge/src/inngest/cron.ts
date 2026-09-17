/**
 * `scheduledCron` (T14 BRD 4.3): the Inngest scheduled function driving
 * recurring posts. Runs on a fixed 15-minute interval, checks which enabled
 * schedules are due (`nextRunAt <= now`, per T17's `Schedule` shape — see
 * `src/lib/schedules-repo.ts`), and for each due schedule calls
 * `createGenerationRun` (T06) directly — the exact same doc-creation +
 * `post/generate.requested` event-emission path `POST /api/generate` and
 * the run-now API route use — so cron-launched runs are indistinguishable
 * from manual ones and appear as normal posts in the library.
 *
 * ---------------------------------------------------------------------
 * `createFunction`'s trigger shape (verified against the installed
 * `inngest@4.20.0` package, `node_modules/inngest/components/triggers/
 * triggers.d.cts` + `Inngest.d.cts`'s `CreateFunctionInput`/`CreateFunction`
 * types), NOT assumed from memory:
 * ---------------------------------------------------------------------
 * `createFunction(options, handler)` is 2-arg. `options.triggers` accepts
 * `SingleOrArray<Trigger>` (a single trigger object OR an array — both are
 * valid; `functions.ts`'s `generatePost` already uses the single-object form
 * for an event trigger). A cron trigger is `{ cron: string }` (a plain cron
 * expression string, standard 5-field syntax, e.g. every-15-minutes (see
 * CRON_INTERVAL below) rather than the older 3-arg `(config, {cron}, handler)`
 * shape older docs/training data describe.
 *
 * ---------------------------------------------------------------------
 * "Trending topic source" (BRD's open question) — decision, not a blocker:
 * ---------------------------------------------------------------------
 * The BRD doesn't specify where a schedule's topic comes from beyond "the
 * configured topic" — it's just whatever the user typed when creating the
 * schedule (identical to `POST /api/generate`'s `topic` field). No curated
 * "trending topics" list or external trend source is implemented; that's
 * out of scope for this task and not required by any BRD requirement or
 * acceptance criterion. Documented as an `info` report (see
 * tasks/reports.jsonl) rather than blocking on it.
 */

import { inngest } from "./client";
import { createGenerationRun } from "@/app/api/generate/core";
import { listDueSchedules, recordScheduleRun, type Cadence } from "@/lib/schedules-repo";

/** Fixed polling interval: checks every 15 minutes which schedules are due. */
const CRON_INTERVAL = "*/15 * * * *";

type DueScheduleSummary = { id: string; topic: string; cadence: Cadence };

export const scheduledCron = inngest.createFunction(
  {
    id: "scheduled-cron",
    retries: 1,
    triggers: { cron: CRON_INTERVAL },
  },
  async ({ step }) => {
    // Plain-object projection (not the raw Mongo docs) so the step's
    // durable checkpoint serializes cleanly to JSON — an ObjectId/Date
    // round-trips through Inngest's step memoization as a string, which
    // would otherwise silently change the shape callers see on replay.
    const due: DueScheduleSummary[] = await step.run("list-due-schedules", async () => {
      const schedules = await listDueSchedules();
      return schedules.map((s) => ({
        id: s._id.toString(),
        topic: s.topic,
        cadence: s.cadence,
      }));
    });

    for (const schedule of due) {
      await step.run(`launch-run-${schedule.id}`, async () => {
        const at = new Date();
        try {
          const run = await createGenerationRun({ topic: schedule.topic });
          await recordScheduleRun(
            schedule.id,
            { status: "success", at, postId: run.id },
            schedule.cadence
          );
          return { scheduleId: schedule.id, postId: run.id, status: "success" as const };
        } catch (err) {
          // Best-effort: record the failed attempt (and still advance
          // nextRunAt, so a persistently-broken schedule doesn't fire on
          // every 15-minute tick forever) before re-throwing so Inngest's
          // own retry/dashboard reflects the real outcome.
          await recordScheduleRun(schedule.id, { status: "failure", at }, schedule.cadence).catch(
            () => {}
          );
          throw err;
        }
      });
    }

    return { checkedCount: due.length, dueCount: due.length };
  }
);
