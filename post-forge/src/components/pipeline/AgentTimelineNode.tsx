import { cn } from "@/lib/cn";
import { AGENT_STAGES, type AgentKey } from "./agents";

export type AgentNodeState = "queued" | "active" | "done" | "failed";

export interface AgentTimelineNodeProps {
  agent: AgentKey;
  state: AgentNodeState;
  /** Elapsed time for this stage, already formatted (e.g. "12s", "1m 04s"). */
  elapsed?: string;
  /** Horizontal (desktop stepper) or vertical (mobile) orientation. */
  orientation?: "horizontal" | "vertical";
  onClick?: () => void;
  className?: string;
}

const stateRing: Record<AgentNodeState, string> = {
  queued: "bg-gray-100 text-gray-400 ring-1 ring-inset ring-border-strong",
  active: "text-white shadow-[var(--shadow-md)]",
  done: "text-white",
  failed: "bg-error-50 text-error-600 ring-1 ring-inset ring-error-200",
};

/**
 * The signature pipeline node: one per Research/Verify/Write/Edit/
 * Illustrate/Publish stage (DESIGN_PROMPT.md screen 6, the hero "agent
 * pipeline showcase"). Colored by the stage's canonical accent from
 * `AGENT_STAGES`; the active stage pulses (respecting reduced-motion via the
 * global CSS override), done stages solid-fill, failed stages get an error
 * ring + label.
 *
 * Exported for T08 (dashboard preview), T11 (live generation screen), and
 * T12 (post detail generation summary) to reuse without redefining stage
 * visuals.
 */
export function AgentTimelineNode({
  agent,
  state,
  elapsed,
  orientation = "horizontal",
  onClick,
  className,
}: AgentTimelineNodeProps) {
  const meta = AGENT_STAGES[agent];
  const Icon = meta.icon;
  const isInteractive = !!onClick;
  const Comp = isInteractive ? "button" : "div";

  return (
    <Comp
      type={isInteractive ? "button" : undefined}
      onClick={onClick}
      aria-current={state === "active" ? "step" : undefined}
      className={cn(
        "flex items-center gap-3",
        orientation === "vertical" ? "flex-row" : "flex-col text-center",
        isInteractive && "cursor-pointer",
        className,
      )}
    >
      <span
        className={cn(
          "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-full)] transition-colors duration-[var(--duration-base)]",
          stateRing[state],
        )}
        style={
          state === "active" || state === "done"
            ? { backgroundColor: `var(--color-${meta.colorToken}-${state === "active" ? "500" : "600"})` }
            : undefined
        }
      >
        {state === "active" && (
          <span
            className="absolute inset-0 rounded-[var(--radius-full)] animate-pulse-ring"
            style={{ color: `var(--color-${meta.colorToken}-500)` }}
            aria-hidden="true"
          />
        )}
        {state === "failed" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 8v5m0 3h.01" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
          </svg>
        ) : (
          <Icon />
        )}
      </span>
      <span className="flex flex-col items-center gap-0.5">
        <span
          className={cn(
            "text-sm font-medium",
            state === "queued" ? "text-gray-400" : state === "failed" ? "text-error-600" : "text-gray-900",
          )}
        >
          {meta.label}
        </span>
        <span className="text-xs capitalize text-gray-400">
          {elapsed ?? state}
        </span>
      </span>
    </Comp>
  );
}
