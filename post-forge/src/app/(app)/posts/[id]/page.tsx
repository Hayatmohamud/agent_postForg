"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePostPolling } from "@/hooks/usePostPolling";
import { usePrefersReducedMotion } from "@/lib/useReducedMotion";
import { AGENT_ORDER, type AgentKey, type AgentNodeState } from "@/components/pipeline";
import { Badge, Button, Card, ErrorState, Skeleton, StatusBadge } from "@/components/ui";
import { formatElapsed, stageElapsedMs } from "@/lib/duration";
import type { PostDetail } from "@/lib/dto";
import type { Stage } from "@/lib/state";
import { PipelineStepper, type StepperStage } from "./PipelineStepper";
import { StageDetailPanel } from "./StageDetailPanel";

function isTerminal(status: PostDetail["status"]): boolean {
  return status === "done" || status === "failed";
}

/**
 * The generation-in-progress hero screen (BRD/T11, DESIGN_PROMPT.md screen
 * 6): polls this post's live state and renders the 6-stage pipeline, an
 * active-stage detail panel, per-stage/overall timers, and the failed state.
 *
 * Once `status === "done"` this hands off to a stub — T12 (next wave) owns
 * the real finished-post view; this task only needs to branch correctly.
 */
export default function PostPipelinePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { post, loading, error } = usePostPolling(id);
  const reducedMotion = usePrefersReducedMotion();

  // Ticks once a second while the run is still live, purely so per-stage /
  // overall elapsed labels advance for the active stage — the timestamps
  // themselves always come from the server (`post.stages`, `post.createdAt`).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!post || isTerminal(post.status)) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [post?.status, post]);

  const activeAgent = useMemo<AgentKey | null>(() => {
    if (!post) return null;
    const active = AGENT_ORDER.find((agent) => post.stages[agent as Stage]?.state === "active");
    if (active) return active;
    if (post.status === "failed") {
      const failed = AGENT_ORDER.find((agent) => post.stages[agent as Stage]?.state === "failed");
      if (failed) return failed;
    }
    return null;
  }, [post]);

  const [focusedAgent, setFocusedAgent] = useState<AgentKey>("research");
  useEffect(() => {
    if (activeAgent) setFocusedAgent(activeAgent);
  }, [activeAgent]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-8 w-2/3" />
        <Card>
          <div className="flex justify-between gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-11 rounded-[var(--radius-full)]" />
            ))}
          </div>
        </Card>
        <Card>
          <Skeleton className="h-32 w-full" />
        </Card>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState
          title="Couldn't load this post"
          description={error ?? "No post was found with this id."}
          action={
            <Link href="/library">
              <Button variant="secondary">Back to library</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (post.status === "done") {
    return <div>Post complete — detail view coming in T12</div>;
  }

  const stepperStages: StepperStage[] = AGENT_ORDER.map((agent) => {
    const stageState = post.stages[agent as Stage];
    const state = (stageState?.state ?? "queued") as AgentNodeState;
    const elapsedMs = stageElapsedMs(stageState?.startedAt, stageState?.endedAt, now);
    return {
      agent,
      state,
      elapsedLabel: elapsedMs !== undefined ? formatElapsed(elapsedMs) : undefined,
    };
  });

  const overallElapsedMs = stageElapsedMs(post.createdAt, isTerminal(post.status) ? post.updatedAt : undefined, now);
  const focusedStageState = post.stages[focusedAgent as Stage];
  const focusedElapsedMs = stageElapsedMs(focusedStageState?.startedAt, focusedStageState?.endedAt, now);
  const focusedEntries = post.subProgress.filter((entry) => entry.stage === focusedAgent);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-wide text-brand-600">Generating</p>
          <h1 className="text-2xl font-semibold text-gray-900">{post.topic}</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={post.status} />
          {overallElapsedMs !== undefined && (
            <Badge tone="neutral">
              <span className="font-mono">{formatElapsed(overallElapsedMs)}</span>
            </Badge>
          )}
        </div>
      </header>

      {post.status === "failed" && <FailedPanel post={post} />}

      <Card>
        <PipelineStepper stages={stepperStages} focusedAgent={focusedAgent} onFocus={setFocusedAgent} />
      </Card>

      <Card>
        <StageDetailPanel
          agent={focusedAgent}
          status={stepperStages.find((s) => s.agent === focusedAgent)?.state ?? "queued"}
          elapsedLabel={focusedElapsedMs !== undefined ? formatElapsed(focusedElapsedMs) : undefined}
          entries={focusedEntries}
          research={post.research}
          verifiedFindings={post.verifiedFindings}
          posterImageId={post.posterImageId}
          isLive={focusedAgent === activeAgent && !reducedMotion}
          reducedMotion={reducedMotion}
        />
      </Card>
    </div>
  );
}

function FailedPanel({ post }: { post: PostDetail }) {
  const failedStage = post.error?.stage;
  return (
    <ErrorState
      title={failedStage ? `The ${failedStage} stage failed` : "Generation failed"}
      description={
        post.error?.message ??
        "Something went wrong while generating this post. The pipeline has stopped and will not retry automatically."
      }
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={{ pathname: "/new-post", query: { topic: post.topic } }}>
            <Button variant="secondary">Try again with this topic</Button>
          </Link>
          <Link href="/library">
            <Button variant="ghost">Back to library</Button>
          </Link>
        </div>
      }
    />
  );
}
