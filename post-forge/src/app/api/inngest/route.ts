import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { generatePost } from "@/inngest/functions";
import { scheduledCron } from "@/inngest/cron";

/**
 * Inngest HTTP endpoint. `generatePost` (T05) was the first registered
 * function; `scheduledCron` (T14) is the second, driving recurring posts.
 *
 * NOTE: local dev requires `INNGEST_DEV=1` (set in the `dev` npm script)
 * so `npx inngest-cli@latest dev` can sync against this route instead of
 * Inngest Cloud (Inngest v4 defaults to cloud mode).
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generatePost, scheduledCron],
});
