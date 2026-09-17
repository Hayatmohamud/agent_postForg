"use client";

import { cn } from "@/lib/cn";
import { AGENT_ORDER, AGENT_STAGES, AgentTimelineNode, type AgentKey, type AgentNodeState } from "@/components/pipeline";

export type StepperStage = {
  agent: AgentKey;
  state: AgentNodeState;
  elapsedLabel?: string;
};

/**
 * The 6-stage pipeline stepper (BRD 4.1, DESIGN_PROMPT.md screen 6):
 * horizontal on desktop, vertical on mobile. Reuses `AgentTimelineNode`
 * (T07) verbatim for each stage's icon/accent/status; this component only
 * owns layout, the connecting rail between stages, and forwarding clicks so
 * the page can focus a stage's detail panel.
 */
export function PipelineStepper({
  stages,
  focusedAgent,
  onFocus,
}: {
  stages: StepperStage[];
  focusedAgent: AgentKey;
  onFocus: (agent: AgentKey) => void;
}) {
  return (
    <>
      {/* Desktop: horizontal stepper with a connecting rail. */}
      <div className="hidden md:flex md:items-start" role="list" aria-label="Generation pipeline">
        {stages.map((stage, i) => (
          <div key={stage.agent} className="flex flex-1 items-start last:flex-none">
            <div role="listitem">
              <AgentTimelineNode
                agent={stage.agent}
                state={stage.state}
                elapsed={stage.elapsedLabel}
                orientation="horizontal"
                onClick={() => onFocus(stage.agent)}
                className={cn(
                  "rounded-[var(--radius-lg)] px-1 py-1 transition-colors",
                  focusedAgent === stage.agent && "bg-gray-50 ring-1 ring-inset ring-border",
                )}
              />
            </div>
            {i < stages.length - 1 && (
              <div
                aria-hidden="true"
                className="mt-5 h-px flex-1 self-start bg-border"
                style={
                  stages[i + 1].state !== "queued"
                    ? { backgroundColor: `var(--color-${AGENT_STAGES[stages[i + 1].agent].colorToken}-500)` }
                    : undefined
                }
              />
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical stepper with a connecting rail. */}
      <div className="flex flex-col gap-0 md:hidden" role="list" aria-label="Generation pipeline">
        {stages.map((stage, i) => (
          <div key={stage.agent} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div role="listitem">
                <AgentTimelineNode
                  agent={stage.agent}
                  state={stage.state}
                  orientation="vertical"
                  onClick={() => onFocus(stage.agent)}
                />
              </div>
              {i < stages.length - 1 && (
                <div
                  aria-hidden="true"
                  className="my-1 w-px flex-1 bg-border"
                  style={
                    stages[i + 1].state !== "queued"
                      ? { backgroundColor: `var(--color-${AGENT_STAGES[stages[i + 1].agent].colorToken}-500)` }
                      : undefined
                  }
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => onFocus(stage.agent)}
              className={cn(
                "-ml-1 flex flex-1 items-center justify-between rounded-[var(--radius-md)] px-2 py-2 text-left",
                focusedAgent === stage.agent && "bg-gray-50 ring-1 ring-inset ring-border",
              )}
            >
              <span className="text-sm font-medium text-gray-900">{AGENT_STAGES[stage.agent].label}</span>
              <span className="text-xs capitalize text-gray-400">{stage.elapsedLabel ?? stage.state}</span>
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export { AGENT_ORDER };
