"use client";

import { AGENT_STAGES, SourceCitationChip, type AgentKey } from "@/components/pipeline";
import { VerifiedBadge } from "@/components/ui";
import type { Finding } from "@/lib/state";
import type { SubProgressEntryDTO } from "@/lib/dto";

type ResearchData = { count: number; queries: string[] };
type ClaimMark = { claim: string; verified: boolean };
type VerifyData = { marks: ClaimMark[] };
type DraftData = { preview: string };
type FinalData = { title?: string; preview: string };
type IllustrateData = { posterImageId?: string };
type AttemptData = { agent: string };

/**
 * The streaming detail panel fed by `subProgress` (BRD 4.2): what the
 * focused stage is doing right now (or, for a completed stage, a summary of
 * what it produced). One panel, one stage at a time — clicking any stepper
 * node (`PipelineStepper`) changes which stage is focused, which is how
 * "completed stages as expandable/collapsed summaries" (BRD 4.3) works here:
 * a done stage's node collapses to a one-line status until it's focused.
 */
export function StageDetailPanel({
  agent,
  status,
  elapsedLabel,
  entries,
  research,
  verifiedFindings,
  posterImageId,
  isLive,
  reducedMotion,
}: {
  agent: AgentKey;
  status: "queued" | "active" | "done" | "failed";
  elapsedLabel?: string;
  entries: SubProgressEntryDTO[];
  research: Finding[];
  verifiedFindings: Finding[];
  posterImageId?: string;
  isLive: boolean;
  reducedMotion: boolean;
}) {
  const meta = AGENT_STAGES[agent];
  const attempts = entries.filter((e) => e.kind === "attempt");
  const completionEntry = entries.find((e) => e.kind !== "attempt");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-full)] text-white"
            style={{ backgroundColor: `var(--color-${meta.colorToken}-600)` }}
          >
            <meta.icon width={14} height={14} />
          </span>
          <h3 className="text-sm font-semibold text-gray-900">{meta.label}</h3>
          {isLive && (
            <span
              className={reducedMotion ? "" : "animate-pulse"}
              aria-hidden="true"
            >
              <span
                className="inline-flex items-center gap-1 rounded-[var(--radius-full)] bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700"
              >
                Live
              </span>
            </span>
          )}
        </div>
        {elapsedLabel && (
          <span className="font-mono text-xs text-gray-400">{elapsedLabel}</span>
        )}
      </div>
      <p className="text-sm text-gray-500">{meta.description}</p>

      {status === "queued" && (
        <p className="text-sm text-gray-400">Waiting for its turn in the pipeline.</p>
      )}

      {status === "failed" && (
        <p className="text-sm font-medium text-error-600">
          This stage failed and stopped the run — see the error above for details.
        </p>
      )}

      {attempts.length > 0 && status !== "done" && (
        <p className="text-xs text-gray-400">
          Retry attempt {attempts.length + 1} in progress
          {(attempts[attempts.length - 1].data as AttemptData | undefined)?.agent
            ? ` (${(attempts[attempts.length - 1].data as AttemptData).agent})`
            : ""}
          &hellip;
        </p>
      )}

      {completionEntry && (
        <StageDetailBody
          agent={agent}
          kind={completionEntry.kind}
          data={completionEntry.data}
          research={research}
          verifiedFindings={verifiedFindings}
          posterImageId={posterImageId}
        />
      )}

      {!completionEntry && status === "active" && agent === "research" && (
        <p className="text-sm text-gray-400">Searching the web&hellip;</p>
      )}
      {!completionEntry && status === "active" && agent === "verify" && (
        <p className="text-sm text-gray-400">Cross-checking each claim&hellip;</p>
      )}
      {!completionEntry && status === "active" && (agent === "write" || agent === "edit") && (
        <p className="text-sm text-gray-400">Drafting text&hellip;</p>
      )}
      {!completionEntry && status === "active" && agent === "illustrate" && (
        <p className="text-sm text-gray-400">Rendering the poster&hellip;</p>
      )}
      {!completionEntry && status === "active" && agent === "publish" && (
        <p className="text-sm text-gray-400">Saving the finished post&hellip;</p>
      )}
    </div>
  );
}

function StageDetailBody({
  agent,
  kind,
  data,
  research,
  verifiedFindings,
  posterImageId,
}: {
  agent: AgentKey;
  kind: string;
  data: unknown;
  research: Finding[];
  verifiedFindings: Finding[];
  posterImageId?: string;
}) {
  switch (agent) {
    case "research": {
      const { count, queries } = (data as ResearchData) ?? { count: 0, queries: [] };
      return (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Found <span className="font-semibold">{count}</span> source{count === 1 ? "" : "s"}
            {queries.length > 0 ? ` across ${queries.length} search${queries.length === 1 ? "" : "es"}.` : "."}
          </p>
          {queries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {queries.map((q, i) => (
                <span
                  key={i}
                  className="rounded-[var(--radius-md)] bg-gray-100 px-2 py-1 font-mono text-xs text-gray-600"
                >
                  {q}
                </span>
              ))}
            </div>
          )}
          {research.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {research.slice(0, 6).map((f, i) => (
                <SourceCitationChip key={i} title={f.source.title} url={f.source.url} />
              ))}
            </div>
          )}
        </div>
      );
    }
    case "verify": {
      const { marks } = (data as VerifyData) ?? { marks: [] };
      const list = marks.length > 0 ? marks : verifiedFindings.map((f) => ({ claim: f.claim, verified: f.verified }));
      return (
        <ul className="space-y-2">
          {list.map((m, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <VerifiedBadge verified={m.verified} className="mt-0.5 shrink-0" />
              <span className="text-gray-700">{m.claim}</span>
            </li>
          ))}
          {list.length === 0 && <p className="text-sm text-gray-400">No claims checked yet.</p>}
        </ul>
      );
    }
    case "write": {
      const { preview } = (data as DraftData) ?? { preview: "" };
      return (
        <blockquote className="rounded-[var(--radius-lg)] border border-border bg-gray-50 p-4 font-serif text-sm leading-relaxed text-gray-700">
          {preview || "Draft is being written…"}
          <span aria-hidden="true">&hellip;</span>
        </blockquote>
      );
    }
    case "edit": {
      const { title, preview } = (data as FinalData) ?? { preview: "" };
      return (
        <div className="space-y-2">
          {title && <p className="text-sm font-semibold text-gray-900">&ldquo;{title}&rdquo;</p>}
          <blockquote className="rounded-[var(--radius-lg)] border border-border bg-gray-50 p-4 font-serif text-sm leading-relaxed text-gray-700">
            {preview || "Polishing the draft…"}
            <span aria-hidden="true">&hellip;</span>
          </blockquote>
        </div>
      );
    }
    case "illustrate": {
      const id = (data as IllustrateData)?.posterImageId ?? posterImageId;
      return (
        <div className="flex items-center gap-3">
          {id ? (
            <img
              src={`/api/posters/${id}`}
              alt="Generated poster preview"
              className="h-24 w-24 rounded-[var(--radius-lg)] border border-border object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-gray-50 text-xs text-gray-400">
              Rendering&hellip;
            </div>
          )}
          <p className="text-sm text-gray-700">Poster ready.</p>
        </div>
      );
    }
    case "publish": {
      return <p className="text-sm text-gray-700">Saved. The post is now in your library.</p>;
    }
    default:
      return null;
  }
}
