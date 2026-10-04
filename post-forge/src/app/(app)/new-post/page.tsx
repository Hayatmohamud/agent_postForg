"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PromptField, useToast } from "@/components/ui";
import type { GenerateRequest, GenerateResponse } from "@/lib/dto";

const MIN_TOPIC_LENGTH = 5;

/** Best-effort extraction of a friendly message from a non-OK /api/generate response body. */
function extractErrorInfo(body: unknown): { message: string; existingPostId?: string } {
  const fallback = "Something went wrong starting this run. Please try again.";
  if (!body || typeof body !== "object") return { message: fallback };
  const obj = body as Record<string, unknown>;
  const error = obj.error;
  const message =
    error && typeof error === "object" && typeof (error as Record<string, unknown>).message === "string"
      ? ((error as Record<string, unknown>).message as string)
      : fallback;
  const existingPostId = typeof obj.existingPostId === "string" ? obj.existingPostId : undefined;
  return { message, existingPostId };
}

export default function NewPostPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [topic, setTopic] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const trimmedTopic = topic.trim();
  const validationError =
    touched && trimmedTopic.length === 0
      ? "Enter a topic to generate a post about."
      : touched && trimmedTopic.length < MIN_TOPIC_LENGTH
        ? `Topic must be at least ${MIN_TOPIC_LENGTH} characters.`
        : undefined;

  async function handleSubmit() {
    setTouched(true);
    if (trimmedTopic.length < MIN_TOPIC_LENGTH || submitting) return;

    setSubmitting(true);
    try {
      const payload: GenerateRequest = { topic: trimmedTopic };

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }

      // Handle any non-201 response generically (covers standard errors AND
      // T19's rate-limit/dedupe response, whatever exact shape it lands on).
      if (!res.ok || res.status !== 201) {
        const { message, existingPostId } = extractErrorInfo(body);
        toast({
          title: "Couldn't start generation",
          description: existingPostId ? `${message} View existing post: /posts/${existingPostId}` : message,
          tone: "error",
          duration: 0,
        });
        setSubmitting(false);
        return;
      }

      const result = body as GenerateResponse;
      router.push(`/posts/${result.id}`);
    } catch {
      toast({
        title: "Couldn't reach the server",
        description: "Check your connection and try again.",
        tone: "error",
      });
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2 pt-2 text-center">
        <h1 className="text-[27px] font-semibold tracking-tight text-text sm:text-[30px]">
          What would you like PostForge to research and create?
        </h1>
        <p className="text-[15px] text-gray-500">
          One topic in. A verified, illustrated, publish-ready post out.
        </p>
      </header>

      <PromptField
        value={topic}
        onChange={(value) => {
          setTopic(value);
          if (!touched) setTouched(true);
        }}
        onSubmit={handleSubmit}
        loading={submitting}
        disabled={submitting}
        error={validationError}
        label=""
      />
    </div>
  );
}
