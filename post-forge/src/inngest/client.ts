import { Inngest } from "inngest";

/**
 * Shared Inngest client for the PostForge app.
 * Durable functions (e.g. the generatePost pipeline built in T05) are
 * registered against this client and passed into `serve()` in
 * `src/app/api/inngest/route.ts`.
 */
export const inngest = new Inngest({ id: "post-forge" });
