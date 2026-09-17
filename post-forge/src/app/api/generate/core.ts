/**
 * Composable "create a generation run" core (T06 BRD 4.1), deliberately
 * split out of `route.ts`: Next.js's App Router route-file export
 * validation only permits exporting HTTP-method handlers (`GET`, `POST`,
 * etc.) from a `route.ts` file — an extra named export like
 * `createGenerationRun` alongside `POST` is rejected at build time. Putting
 * the reusable logic here instead lets `route.ts` stay a thin adapter, and
 * lets future callers (T19's rate-limit/dedupe wrapper, T14's cron) import
 * and call this directly without going through HTTP.
 */

import { z } from "zod";
import { inngest } from "@/inngest/client";
import { createPost } from "@/lib/posts-repo";
import type { GenerationOptions } from "@/lib/state";

/** `GenerationOptions` validated exactly as `state.ts` defines it. */
export const generationOptionsSchema = z.object({
  model: z.string().min(1).optional(),
  imageModel: z.string().min(1).optional(),
  tone: z.string().min(1).optional(),
  length: z.enum(["short", "medium", "long"]).optional(),
}) satisfies z.ZodType<GenerationOptions>;

/** Request body schema for `POST /api/generate`. */
export const generateRequestSchema = z.object({
  topic: z.string().trim().min(1, "topic is required"),
  options: generationOptionsSchema.optional(),
});

export type GenerateRequestInput = z.infer<typeof generateRequestSchema>;

export type CreateGenerationRunResult = {
  id: string;
  runId: string;
};

/**
 * Creates the post doc (owning both doc creation and `runId` minting per
 * the BRD) and emits the `post/generate.requested` event the Inngest
 * function (T05) consumes. Returns the navigable post id + runId.
 */
export async function createGenerationRun(
  input: GenerateRequestInput
): Promise<CreateGenerationRunResult> {
  const runId = crypto.randomUUID();
  const options: GenerationOptions = input.options ?? {};

  const post = await createPost(input.topic, runId, options);
  const id = post._id.toString();

  await inngest.send({
    name: "post/generate.requested",
    data: { postId: id, runId, topic: input.topic, options },
  });

  return { id, runId };
}
