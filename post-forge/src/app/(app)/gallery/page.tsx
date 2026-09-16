"use client";

import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  FilterGroup,
  Input,
  Modal,
  Pagination,
  PromptField,
  Select,
  Skeleton,
  SkeletonText,
  StatusBadge,
  Tabs,
  Textarea,
  Tooltip,
  ToastProvider,
  VerifiedBadge,
  useToast,
} from "@/components/ui";
import {
  AGENT_ORDER,
  AGENT_STAGES,
  AgentTimelineNode,
  SourceCitationChip,
  type AgentNodeState,
} from "@/components/pipeline";

const GRAY_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
const BRAND_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
const SEMANTIC_TONES = ["success", "warning", "error", "info"] as const;
const DEMO_STATES: AgentNodeState[] = ["done", "done", "active", "queued", "queued", "queued"];

function Swatch({ varName, label }: { varName: string; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="h-14 w-full rounded-[var(--radius-md)] border border-border"
        style={{ backgroundColor: `var(${varName})` }}
      />
      <span className="font-mono text-[11px] text-gray-500">{label}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function GalleryInner() {
  const { toast } = useToast();
  const [promptValue, setPromptValue] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");

  return (
    <div className="mx-auto max-w-5xl space-y-16 px-6 py-12">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-wide text-brand-600">T07 · Design system</p>
        <h1 className="text-3xl font-semibold text-gray-900">PostForge component gallery</h1>
        <p className="max-w-2xl text-gray-500">
          Every token and primitive from <span className="font-mono">DESIGN_PROMPT.md</span> sections 4–5,
          rendered with real props so the system can be reviewed in one place. Light theme only.
        </p>
      </header>

      <Section title="Color — neutral scale">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-11">
          {GRAY_STEPS.map((s) => (
            <Swatch key={s} varName={`--color-gray-${s}`} label={`gray-${s}`} />
          ))}
        </div>
      </Section>

      <Section title="Color — brand accent (indigo)">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-10">
          {BRAND_STEPS.map((s) => (
            <Swatch key={s} varName={`--color-brand-${s}`} label={`brand-${s}`} />
          ))}
        </div>
      </Section>

      <Section title="Color — semantic">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SEMANTIC_TONES.map((tone) => (
            <Swatch key={tone} varName={`--color-${tone}-600`} label={`${tone}-600`} />
          ))}
        </div>
      </Section>

      <Section title="Color — six agent-stage accents">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {AGENT_ORDER.map((key) => (
            <Swatch
              key={key}
              varName={`--color-${AGENT_STAGES[key].colorToken}-500`}
              label={AGENT_STAGES[key].label}
            />
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <div className="space-y-3">
          <p className="text-4xl font-semibold text-gray-900">Display / UI sans (Geist)</p>
          <p className="text-2xl font-semibold text-gray-900">Heading — h1</p>
          <p className="text-lg font-medium text-gray-900">Heading — h3</p>
          <p className="text-base text-gray-700">
            Body text in the UI sans face, used for all interface chrome and controls.
          </p>
          <p className="font-serif text-xl text-gray-900">
            Editorial serif (Lora) — used only for rendered post-article body copy, so a finished
            post reads like a real piece of writing rather than app UI.
          </p>
          <p className="font-mono text-sm text-gray-600">
            font-mono — source URLs, model ids (openai/gpt-5.5), run ids
          </p>
          <p className="text-sm text-gray-500">Small / caption text — 14px, gray-500 (4.6:1 AA)</p>
        </div>
      </Section>

      <Section title="Spacing, radius, elevation">
        <div className="flex flex-wrap items-end gap-4">
          {[1, 2, 3, 4, 6, 8].map((n) => (
            <div key={n} className="flex flex-col items-center gap-1">
              <div className="bg-brand-200" style={{ width: n * 8, height: n * 8 }} />
              <span className="font-mono text-[11px] text-gray-500">{n * 8}px</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          {(["xs", "sm", "md", "lg", "xl", "2xl", "full"] as const).map((r) => (
            <div key={r} className="flex flex-col items-center gap-1">
              <div
                className="h-14 w-14 border border-border-strong bg-white"
                style={{ borderRadius: `var(--radius-${r})` }}
              />
              <span className="font-mono text-[11px] text-gray-500">radius-{r}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4">
          {(["xs", "sm", "md", "lg", "xl"] as const).map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <div
                className="h-14 w-14 rounded-[var(--radius-lg)] bg-white"
                style={{ boxShadow: `var(--shadow-${s})` }}
              />
              <span className="font-mono text-[11px] text-gray-500">shadow-{s}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Inputs, textarea, select">
        <div className="grid max-w-xl gap-4">
          <Input label="Topic" placeholder="World Cup 2026" hint="Try to be specific." />
          <Input label="With error" defaultValue="bad value" error="This field is required." />
          <Textarea label="Notes" placeholder="Optional context for the writer agent..." />
          <Select
            label="Model"
            options={[
              { value: "openai/gpt-5.5", label: "openai/gpt-5.5" },
              { value: "google/gemini-2.5-flash-lite", label: "google/gemini-2.5-flash-lite" },
            ]}
          />
        </div>
      </Section>

      <Section title="Hero prompt field">
        <PromptField
          value={promptValue}
          onChange={setPromptValue}
          onSubmit={() => toast({ title: "Generating…", description: promptValue || "(empty)", tone: "info" })}
          suggestions={["World Cup 2026", "The future of remote work", "Best budget mirrorless cameras"]}
        />
      </Section>

      <Section title="Tabs">
        <Tabs
          items={[
            { value: "overview", label: "Overview", content: <p className="text-sm text-gray-600">Overview panel content.</p> },
            { value: "sources", label: "Sources", content: <p className="text-sm text-gray-600">Sources panel content.</p> },
            { value: "disabled", label: "Locked", content: null, disabled: true },
          ]}
        />
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>World Cup 2026 preview</CardTitle>
              <StatusBadge status="done" />
            </CardHeader>
            <CardDescription>Generated 2 hours ago · openai/gpt-5.5</CardDescription>
            <CardFooter>
              <Button size="sm" variant="secondary">View</Button>
              <Button size="sm" variant="ghost">Delete</Button>
            </CardFooter>
          </Card>
          <Card interactive>
            <CardHeader>
              <CardTitle>Interactive card</CardTitle>
            </CardHeader>
            <CardDescription>Hover to see the elevation change.</CardDescription>
          </Card>
        </div>
      </Section>

      <Section title="Badges & status pills">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="brand">Brand</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="error">Error</Badge>
          <Badge tone="info">Info</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status="researching" />
          <StatusBadge status="writing" />
          <StatusBadge status="illustrating" />
          <StatusBadge status="done" />
          <StatusBadge status="failed" />
          <VerifiedBadge verified />
          <VerifiedBadge verified={false} />
        </div>
      </Section>

      <Section title="Avatars & tooltips">
        <div className="flex items-center gap-3">
          <Avatar name="Ada Lovelace" size="sm" />
          <Avatar name="Grace Hopper" size="md" />
          <Avatar name="Alan Turing" size="lg" />
          <Tooltip content="This is a helpful tooltip">
            <Button variant="secondary" size="sm">Hover me</Button>
          </Tooltip>
        </div>
      </Section>

      <Section title="Toasts, modal, drawer">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => toast({ title: "Post published", tone: "success" })}>Success toast</Button>
          <Button variant="secondary" onClick={() => toast({ title: "Verification failed", description: "2 claims could not be confirmed.", tone: "error" })}>
            Error toast
          </Button>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>Open drawer</Button>
        </div>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Regenerate post?" footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => setModalOpen(false)}>Regenerate</Button>
          </>
        }>
          <p className="text-sm text-gray-600">This will re-run the full pipeline for this topic.</p>
        </Modal>
        <Modal variant="drawer" open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Run details">
          <p className="text-sm text-gray-600">Drawer content — stage logs, timestamps, etc.</p>
        </Modal>
      </Section>

      <Section title="Empty state & skeleton loaders">
        <div className="grid gap-4 sm:grid-cols-2">
          <EmptyState
            title="No posts yet"
            description="Generate your first post to see it here."
            action={<Button size="sm">New post</Button>}
          />
          <Card>
            <div className="space-y-3">
              <Skeleton className="h-32 w-full" />
              <SkeletonText lines={3} />
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Pagination & filters">
        <FilterGroup
          label="Status"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "done", label: "Done" },
            { value: "failed", label: "Failed" },
          ]}
        />
        <Pagination page={page} pageCount={5} onPageChange={setPage} />
      </Section>

      <Section title="Signature primitive — AgentTimelineNode">
        <div className="flex flex-wrap items-start justify-between gap-4 overflow-x-auto py-2">
          {AGENT_ORDER.map((key, i) => (
            <AgentTimelineNode key={key} agent={key} state={DEMO_STATES[i]} elapsed={i < 2 ? "8s" : undefined} />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {AGENT_ORDER.slice(0, 3).map((key) => (
            <AgentTimelineNode key={key} agent={key} state="failed" orientation="vertical" />
          ))}
        </div>
      </Section>

      <Section title="Signature primitive — SourceCitationChip">
        <div className="grid max-w-xl gap-2">
          <SourceCitationChip title="FIFA World Cup 2026 official site" url="https://www.fifa.com/world-cup" verified />
          <SourceCitationChip title="Wikipedia: 2026 FIFA World Cup" url="https://en.wikipedia.org/wiki/2026_FIFA_World_Cup" verified={false} />
          <SourceCitationChip title="Unreviewed source" url="https://example.com/article" />
        </div>
      </Section>
    </div>
  );
}

export default function GalleryPage() {
  return (
    <ToastProvider>
      <GalleryInner />
    </ToastProvider>
  );
}
