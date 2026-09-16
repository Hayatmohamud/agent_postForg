"use client";

import { useState } from "react";
import { PromptField } from "@/components/ui";

/**
 * Placeholder for T11 (New Post / topic input). Exists so the sidebar's
 * "New Post" link and the topbar CTA have a real destination. T11 replaces
 * this content with the full hero prompt experience + advanced controls.
 */
export default function NewPostPage() {
  const [topic, setTopic] = useState("");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-wide text-brand-600">New post</p>
        <h1 className="text-2xl font-semibold text-gray-900">What should we write about?</h1>
        <p className="text-sm text-gray-500">
          Placeholder route — T11 builds the full generation entry point (model/tone controls,
          validation, submit to the pipeline).
        </p>
      </header>
      <PromptField
        value={topic}
        onChange={setTopic}
        onSubmit={() => undefined}
        suggestions={["World Cup 2026", "The future of remote work", "Best budget mirrorless cameras"]}
      />
    </div>
  );
}
