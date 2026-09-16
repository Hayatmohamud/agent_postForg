import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { generatePost } from "@/inngest/functions";

/**
 * Inngest HTTP endpoint. `generatePost` (T05) is the first registered
 * function; later tasks (e.g. T14's cron) add further entries.
 *
 * NOTE: local dev requires `INNGEST_DEV=1` (set in the `dev` npm script)
 * so `npx inngest-cli@latest dev` can sync against this route instead of
 * Inngest Cloud (Inngest v4 defaults to cloud mode).
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generatePost],
});
