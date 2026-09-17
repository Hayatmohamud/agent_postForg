"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  PromptField,
  Select,
  useToast,
} from "@/components/ui";
import type { GenerateRequest, GenerateResponse, SettingsDTO } from "@/lib/dto";
import type { GenerationOptions } from "@/lib/state";

const MIN_TOPIC_LENGTH = 5;

const SUGGESTED_TOPICS = [
  "World Cup 2026",
  "The future of remote work",
  "Best budget mirrorless cameras",
  "How AI is changing software engineering",
  "A beginner's guide to home coffee roasting",
];

/** OpenRouter text-model slugs offered in the UI (mirrors CLAUDE.md's env contract defaults). */
const MODEL_OPTIONS = [
  { value: "openai/gpt-5.5", label: "GPT-5.5 (smart, default)" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (cheap, fast)" },
];

/** Poster image providers, per PLAN.md's "Nano Banana vs GPT Image" pairing. */
const IMAGE_MODEL_OPTIONS = [
  { value: "google/gemini-3.1-flash-image", label: "Nano Banana (Gemini 3.1 Flash Image)" },
  { value: "openai/gpt-image-1", label: "GPT Image" },
];

const TONE_OPTIONS = [
  { value: "neutral", label: "Neutral" },
  { value: "witty", label: "Witty" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "enthusiastic", label: "Enthusiastic" },
];

const LENGTH_OPTIONS = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

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

  const [model, setModel] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [tone, setTone] = useState("");
  const [length, setLength] = useState<GenerationOptions["length"] | "">("");

  // Prefill advanced controls from GET /api/settings defaults, when present.
  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const settings: SettingsDTO = await res.json();
        if (cancelled) return;
        if (settings.model) setModel(settings.model);
        if (settings.imageModel) setImageModel(settings.imageModel);
        if (settings.tone) setTone(settings.tone);
        if (settings.length) setLength(settings.length);
      } catch {
        // Settings prefill is a nicety, not a blocker — silently fall back to
        // the built-in defaults (pipeline itself applies its own if omitted).
      }
    }
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

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
      const options: GenerationOptions = {};
      if (model) options.model = model;
      if (imageModel) options.imageModel = imageModel;
      if (tone) options.tone = tone;
      if (length) options.length = length;

      const payload: GenerateRequest = {
        topic: trimmedTopic,
        ...(Object.keys(options).length > 0 ? { options } : {}),
      };

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
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-wide text-brand-600">New post</p>
        <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">What should we write about?</h1>
        <p className="text-sm text-gray-500">
          Give the network a topic and it will research, verify, write, edit, illustrate, and publish a
          finished post — fully autonomously.
        </p>
      </header>

      <PromptField
        value={topic}
        onChange={(value) => {
          setTopic(value);
          if (!touched) setTouched(true);
        }}
        onSubmit={handleSubmit}
        suggestions={SUGGESTED_TOPICS}
        loading={submitting}
        disabled={submitting}
        error={validationError}
      />

      <Card>
        <CardHeader>
          <CardTitle>Advanced options</CardTitle>
        </CardHeader>
        <CardDescription>
          Leave any of these unset to use your Settings defaults (or the pipeline&apos;s built-in defaults).
        </CardDescription>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Select
            label="Model"
            hint="OpenRouter text model used by every writing agent."
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={submitting}
            options={[{ value: "", label: "Use default" }, ...MODEL_OPTIONS]}
          />
          <Select
            label="Poster image model"
            hint="Provider used to generate the poster image."
            value={imageModel}
            onChange={(e) => setImageModel(e.target.value)}
            disabled={submitting}
            options={[{ value: "", label: "Use default" }, ...IMAGE_MODEL_OPTIONS]}
          />
          <Select
            label="Tone"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            disabled={submitting}
            options={[{ value: "", label: "Use default" }, ...TONE_OPTIONS]}
          />
          <Select
            label="Length"
            value={length}
            onChange={(e) => setLength(e.target.value as GenerationOptions["length"])}
            disabled={submitting}
            options={[{ value: "", label: "Use default" }, ...LENGTH_OPTIONS]}
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSubmit} loading={submitting} disabled={submitting || !trimmedTopic}>
          Generate
        </Button>
      </div>
    </div>
  );
}
