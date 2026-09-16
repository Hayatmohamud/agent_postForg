import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";

/**
 * Inngest HTTP endpoint. No functions are registered yet — later tasks
 * (starting with T05's `generatePost`) add entries to this array.
 *
 * NOTE: local dev requires `INNGEST_DEV=1` (set in the `dev` npm script)
 * so `npx inngest-cli@latest dev` can sync against this route instead of
 * Inngest Cloud (Inngest v4 defaults to cloud mode).
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [],
});
