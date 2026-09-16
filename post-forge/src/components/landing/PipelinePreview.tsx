"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
import {
  AGENT_ORDER,
  AGENT_STAGES,
  AgentTimelineNode,
  type AgentNodeState,
} from "@/components/pipeline";

const STEP_MS = 1600;

function statesForActive(activeIndex: number): AgentNodeState[] {
  return AGENT_ORDER.map((_, i) => {
    if (i < activeIndex) return "done";
    if (i === activeIndex) return "active";
    return "queued";
  });
}

/**
 * Hero pipeline preview (T09 landing). Cycles the six pipeline stages through
 * queued -> active -> done using the canonical AGENT_STAGES accents, so the
 * marketing page previews the same signature visual the live generation
 * screen (T11) uses.
 *
 * Reduced-motion handling (two layers, both real):
 * 1. CSS: the active node's pulse ring uses `animate-pulse-ring`, which the
 *    global `@media (prefers-reduced-motion: reduce)` block in globals.css
 *    already collapses to a near-zero duration.
 * 2. JS: this component additionally stops the `setInterval` that cycles
 *    which stage is "active" when `usePrefersReducedMotion()` is true, so a
 *    reduced-motion visitor gets one static, settled frame (Publish shown as
 *    the resting/complete stage) instead of content that keeps changing
 *    every 1.6s regardless of CSS.
 */
export function PipelinePreview({ className }: { className?: string }) {
  const reducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % (AGENT_ORDER.length + 1));
    }, STEP_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  // Reduced motion: freeze on a settled frame (last stage marked done, no cycling).
  const effectiveActive = reducedMotion ? AGENT_ORDER.length : activeIndex;
  const states = statesForActive(effectiveActive);

  return (
    <div
      className={cn(
        "w-full rounded-[var(--radius-2xl)] border border-border bg-white p-6 shadow-[var(--shadow-lg)] sm:p-8",
        className,
      )}
      role="img"
      aria-label="Animated preview of the six-stage PostForge pipeline: Research, Verify, Write, Edit, Illustrate, Publish"
    >
      <div className="mb-6 flex items-center justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-wide text-gray-400">Live pipeline preview</p>
        <span className="hidden font-mono text-xs text-gray-400 sm:inline">topic → finished post</span>
      </div>
      <div
        className="flex items-start justify-between gap-2 overflow-x-auto pb-2 sm:gap-4"
        aria-hidden="true"
      >
        {AGENT_ORDER.map((key, i) => (
          <div key={key} className="flex flex-1 items-start">
            <AgentTimelineNode agent={key} state={states[i]} className="min-w-[64px] shrink-0" />
            {i < AGENT_ORDER.length - 1 && (
              <div
                className="mt-5 h-px w-full shrink grow"
                style={{
                  background:
                    states[i] === "queued"
                      ? "var(--color-border)"
                      : `var(--color-${AGENT_STAGES[key].colorToken}-300)`,
                }}
              />
            )}
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-gray-500">
        {reducedMotion
          ? "Six autonomous agents take your topic from a blank page to a sourced, illustrated post."
          : "Watch six autonomous agents take your topic from a blank page to a sourced, illustrated post — live."}
      </p>
    </div>
  );
}
