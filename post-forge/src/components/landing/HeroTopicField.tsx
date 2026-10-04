"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

const QUICK_TOPICS = ["Humanoid robots", "Fusion energy", "Small language models"];

/**
 * Hero topic field — client-only (needs router + input state), split out of
 * the landing page's server component so the page keeps its `metadata`
 * export. Routes into sign-up with the typed topic (no anonymous generation
 * backend exists), matching the imported design's hero without faking a
 * live public demo.
 */
export function HeroTopicField() {
  const router = useRouter();
  const [topic, setTopic] = useState("");

  function go() {
    const trimmed = topic.trim();
    router.push(trimmed ? `/sign-up?topic=${encodeURIComponent(trimmed)}` : "/sign-up");
  }

  return (
    <div className="mt-8">
      <div
        className="flex items-center gap-2 rounded-[var(--radius-xl)] border border-border-strong bg-surface p-1.5 pl-4 shadow-[var(--shadow-sm)] focus-within:border-brand-500 focus-within:shadow-[var(--shadow-md)]"
      >
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go();
          }}
          placeholder="The rise of AI agents"
          aria-label="Topic"
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
        <Button onClick={go} className="shrink-0">
          Generate
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-500">
        Try:
        {QUICK_TOPICS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTopic(t)}
            className="rounded-[var(--radius-full)] border border-border bg-surface px-3 py-1.5 text-sm text-gray-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
