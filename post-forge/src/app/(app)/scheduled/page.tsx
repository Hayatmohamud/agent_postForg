"use client";

/**
 * `/scheduled` (T14 BRD 4.4): recurring-post schedule management — list,
 * create/edit form, enable/disable toggle, run-now action, empty state.
 * Drives `src/app/api/schedules/**` (T14), which in turn share
 * `createGenerationRun` (T06) with the cron function (`src/inngest/cron.ts`)
 * so runs launched here appear as normal posts in the library (BRD
 * acceptance criteria).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
  useToast,
} from "@/components/ui";

type Cadence = "daily" | "weekly";

type ScheduleLastResultDTO = {
  status: "success" | "failure";
  at: string;
  postId?: string;
};

type ScheduleDTO = {
  id: string;
  topic: string;
  cadence: Cadence;
  enabled: boolean;
  nextRunAt: string;
  lastResult?: ScheduleLastResultDTO;
  createdAt: string;
  updatedAt: string;
};

type ErrorBody = { error?: { message?: string } };

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as ErrorBody;
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}

const CADENCE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

type FormState = { topic: string; cadence: Cadence; enabled: boolean };

const EMPTY_FORM: FormState = { topic: "", cadence: "daily", enabled: true };

function ScheduleForm({
  initial,
  submitLabel,
  submitting,
  onCancel,
  onSubmit,
}: {
  initial: FormState;
  submitLabel: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (form: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const topicInvalid = form.topic.trim().length === 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (topicInvalid) return;
        onSubmit(form);
      }}
    >
      <Input
        label="Topic"
        placeholder="e.g. Daily AI News Roundup"
        value={form.topic}
        onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
        autoFocus
      />
      <Select
        label="Cadence"
        options={CADENCE_OPTIONS}
        value={form.cadence}
        onChange={(e) => setForm((f) => ({ ...f, cadence: e.target.value as Cadence }))}
      />
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border-strong text-brand-600 focus-visible:outline-brand-500"
          checked={form.enabled}
          onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
        />
        Enabled
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting} disabled={topicInvalid}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export default function ScheduledPage() {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<ScheduleDTO[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleDTO | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/schedules");
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to load schedules"));
      }
      const body = (await res.json()) as { items: ScheduleDTO[] };
      setSchedules(body.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load schedules");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(form: FormState) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to create schedule"));
      }
      setCreateOpen(false);
      toast({ title: "Schedule created", tone: "success" });
      await load();
    } catch (err) {
      toast({
        title: "Couldn't create schedule",
        description: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSubmit(form: FormState) {
    if (!editing) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/schedules/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to update schedule"));
      }
      setEditing(null);
      toast({ title: "Schedule updated", tone: "success" });
      await load();
    } catch (err) {
      toast({
        title: "Couldn't update schedule",
        description: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleEnabled(schedule: ScheduleDTO) {
    setBusyId(schedule.id);
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !schedule.enabled }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to update schedule"));
      }
      await load();
    } catch (err) {
      toast({
        title: "Couldn't update schedule",
        description: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(schedule: ScheduleDTO) {
    setBusyId(schedule.id);
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to delete schedule"));
      }
      toast({ title: "Schedule deleted", tone: "success" });
      await load();
    } catch (err) {
      toast({
        title: "Couldn't delete schedule",
        description: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleRunNow(schedule: ScheduleDTO) {
    setBusyId(schedule.id);
    try {
      const res = await fetch(`/api/schedules/${schedule.id}/run-now`, { method: "POST" });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, "Failed to start run"));
      }
      toast({
        title: "Run started",
        description: "The post will appear in your library shortly.",
        tone: "success",
      });
      await load();
    } catch (err) {
      toast({
        title: "Couldn't start run",
        description: err instanceof Error ? err.message : undefined,
        tone: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-wide text-brand-600">Scheduled</p>
          <h1 className="text-2xl font-semibold text-gray-900">Scheduled posts</h1>
          <p className="text-sm text-gray-500">
            Set up a recurring topic and PostForge will auto-generate a post on a daily or
            weekly cadence.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New schedule</Button>
      </header>

      {loadError && (
        <ErrorState
          title="Couldn't load schedules"
          description={loadError}
          action={
            <Button variant="secondary" onClick={load}>
              Retry
            </Button>
          }
        />
      )}

      {!loadError && schedules === null && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!loadError && schedules !== null && schedules.length === 0 && (
        <EmptyState
          title="No schedules yet"
          description="Set up a recurring topic to auto-generate posts."
          action={<Button onClick={() => setCreateOpen(true)}>New schedule</Button>}
        />
      )}

      {!loadError && schedules !== null && schedules.length > 0 && (
        <ul className="space-y-3">
          {schedules.map((schedule) => (
            <li key={schedule.id}>
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>{schedule.topic}</CardTitle>
                    <CardDescription>
                      {schedule.cadence === "daily" ? "Daily" : "Weekly"} · Next run{" "}
                      {formatDateTime(schedule.nextRunAt)}
                    </CardDescription>
                  </div>
                  <Badge tone={schedule.enabled ? "success" : "neutral"}>
                    {schedule.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </CardHeader>

                {schedule.lastResult && (
                  <div className="text-sm text-gray-500">
                    Last run: {formatDateTime(schedule.lastResult.at)} —{" "}
                    <Badge tone={schedule.lastResult.status === "success" ? "success" : "error"}>
                      {schedule.lastResult.status === "success" ? "Success" : "Failed"}
                    </Badge>
                    {schedule.lastResult.postId && (
                      <>
                        {" "}
                        <Link
                          href={`/library?postId=${schedule.lastResult.postId}`}
                          className="text-brand-600 hover:underline"
                        >
                          View post
                        </Link>
                      </>
                    )}
                  </div>
                )}

                <CardFooter className="flex-wrap justify-between">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRunNow(schedule)}
                      loading={busyId === schedule.id}
                    >
                      Run now
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggleEnabled(schedule)}
                      loading={busyId === schedule.id}
                    >
                      {schedule.enabled ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(schedule)}>
                      Edit
                    </Button>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(schedule)}
                    loading={busyId === schedule.id}
                  >
                    Delete
                  </Button>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New schedule">
        <ScheduleForm
          initial={EMPTY_FORM}
          submitLabel="Create"
          submitting={submitting}
          onCancel={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      </Modal>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Edit schedule">
        {editing && (
          <ScheduleForm
            initial={{ topic: editing.topic, cadence: editing.cadence, enabled: editing.enabled }}
            submitLabel="Save"
            submitting={submitting}
            onCancel={() => setEditing(null)}
            onSubmit={handleEditSubmit}
          />
        )}
      </Modal>
    </div>
  );
}
