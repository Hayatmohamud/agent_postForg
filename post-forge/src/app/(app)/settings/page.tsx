"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  Select,
  useToast,
  type BadgeTone,
} from "@/components/ui";
import type { SettingsDTO } from "@/lib/dto";
import type { SettingsTestProvider, SettingsTestResult } from "@/app/api/settings/test/route";

/**
 * Settings screen (T15 BRD): profile/account (cosmetic), integration status
 * + test-connection (env-only keys — never a key-entry field anywhere),
 * generation defaults persisted via `GET/PUT /api/settings` and consumed by
 * the New Post screen (T11), and a danger zone with an explicit confirm
 * step before any destructive action.
 */

const LENGTH_OPTIONS = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

const INTEGRATIONS: { provider: SettingsTestProvider; name: string; description: string }[] = [
  {
    provider: "openrouter",
    name: "OpenRouter",
    description: "Text generation for every agent (research, verify, write, edit).",
  },
  {
    provider: "image",
    name: "Image provider",
    description: "Poster image generation, routed through OpenRouter (same credential as above).",
  },
  {
    provider: "serper",
    name: "Serper",
    description: "Web search used by the research and verify agents.",
  },
  {
    provider: "mongodb",
    name: "MongoDB",
    description: "Persistence for posts, poster images (GridFS), and settings.",
  },
];

type ProbeState = { status: "idle" | "loading" | "done"; result?: SettingsTestResult };

function StatusPill({ probe }: { probe: ProbeState }) {
  if (probe.status === "idle") {
    return <Badge tone="neutral">Not tested</Badge>;
  }
  if (probe.status === "loading") {
    return <Badge tone="info">Testing…</Badge>;
  }
  const tone: BadgeTone = probe.result?.ok ? "success" : "error";
  return <Badge tone={tone}>{probe.result?.ok ? "Connected" : "Failed"}</Badge>;
}

function IntegrationRow({
  provider,
  name,
  description,
  probe,
  onTest,
}: {
  provider: SettingsTestProvider;
  name: string;
  description: string;
  probe: ProbeState;
  onTest: (provider: SettingsTestProvider) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-900">{name}</p>
          <StatusPill probe={probe} />
        </div>
        <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        {probe.status === "done" && (
          <p className={"mt-1 text-sm " + (probe.result?.ok ? "text-success-700" : "text-error-600")}>
            {probe.result?.message}
          </p>
        )}
      </div>
      <Button
        variant="secondary"
        size="sm"
        loading={probe.status === "loading"}
        onClick={() => onTest(provider)}
        className="shrink-0"
      >
        Test connection
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();

  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [form, setForm] = useState<SettingsDTO>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [probes, setProbes] = useState<Record<SettingsTestProvider, ProbeState>>({
    openrouter: { status: "idle" },
    image: { status: "idle" },
    serper: { status: "idle" },
    mongodb: { status: "idle" },
  });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Failed to load settings (${res.status})`);
      }
      const data: SettingsDTO = await res.json();
      setSettings(data);
      setForm(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const isDirty =
    settings !== null &&
    (form.model !== settings.model ||
      form.imageModel !== settings.imageModel ||
      form.tone !== settings.tone ||
      form.length !== settings.length);

  async function handleSave() {
    setSaving(true);
    setFieldErrors({});
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error?.message ?? `Failed to save settings (${res.status})`);
      }
      setSettings(body);
      setForm(body);
      toast({ title: "Defaults saved", tone: "success" });
    } catch (err) {
      toast({
        title: "Couldn't save defaults",
        description: err instanceof Error ? err.message : "Unknown error",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(provider: SettingsTestProvider) {
    setProbes((prev) => ({ ...prev, [provider]: { status: "loading" } }));
    try {
      const res = await fetch("/api/settings/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const result: SettingsTestResult = await res.json();
      setProbes((prev) => ({ ...prev, [provider]: { status: "done", result } }));
    } catch (err) {
      setProbes((prev) => ({
        ...prev,
        [provider]: {
          status: "done",
          result: {
            provider,
            ok: false,
            message: err instanceof Error ? err.message : "Request failed",
          },
        },
      }));
    }
  }

  const confirmValid = confirmText.trim().toUpperCase() === "DELETE";

  async function handleDeleteAllPosts() {
    if (!confirmValid) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/settings/posts", { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(body?.error?.message ?? `Failed to delete posts (${res.status})`);
      }
      toast({
        title: "All posts deleted",
        description: `${body.deletedCount} post(s) removed, including poster images.`,
        tone: "success",
      });
      setConfirmOpen(false);
      setConfirmText("");
    } catch (err) {
      toast({
        title: "Couldn't delete posts",
        description: err instanceof Error ? err.message : "Unknown error",
        tone: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-wide text-brand-600">Settings</p>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">
          Manage your profile, integration status, generation defaults, and account data.
        </p>
      </header>

      {/* Profile / account — static/cosmetic, no auth backend per CLAUDE.md */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <div className="flex items-center gap-4">
          <Avatar name="PostForge User" size="lg" />
          <div>
            <p className="text-sm font-medium text-gray-900">PostForge User</p>
            <p className="text-sm text-gray-500">hayadmohamudhassan@gmail.com</p>
          </div>
        </div>
        <CardDescription className="mt-3">
          Single-user local workspace — there is no multi-account login in this build.
        </CardDescription>
      </Card>

      {/* Integrations — status + test-connection only, never a key field. */}
      <Card noPadding>
        <div className="px-5 pt-5">
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
          </CardHeader>
          <CardDescription>
            API keys are configured via environment variables only. Test each connection below —
            this never displays or accepts a secret value.
          </CardDescription>
        </div>
        <div className="px-5 pb-2">
          {INTEGRATIONS.map((integration) => (
            <IntegrationRow
              key={integration.provider}
              provider={integration.provider}
              name={integration.name}
              description={integration.description}
              probe={probes[integration.provider]}
              onTest={handleTest}
            />
          ))}
        </div>
      </Card>

      {/* Generation defaults — feed New Post (T11) via GET /api/settings. */}
      <Card>
        <CardHeader>
          <CardTitle>Generation defaults</CardTitle>
        </CardHeader>
        <CardDescription>
          Defaults applied to every new post unless overridden on the New Post screen.
        </CardDescription>

        {loadingSettings ? (
          <p className="mt-4 text-sm text-gray-500">Loading…</p>
        ) : loadError ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-error-600">{loadError}</p>
            <Button variant="secondary" size="sm" onClick={() => void loadSettings()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Default text model"
              placeholder="e.g. openai/gpt-5.5"
              hint="An OpenRouter model id. Leave blank to use the server default."
              value={form.model ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value || undefined }))}
              error={fieldErrors.model}
            />
            <Input
              label="Default image model"
              placeholder="e.g. google/gemini-3.1-flash-image"
              hint="An OpenRouter image model id. Leave blank to use the server default."
              value={form.imageModel ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, imageModel: e.target.value || undefined }))}
              error={fieldErrors.imageModel}
            />
            <Input
              label="Default tone"
              placeholder="e.g. witty, formal, upbeat"
              value={form.tone ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value || undefined }))}
              error={fieldErrors.tone}
            />
            <Select
              label="Default length"
              options={[{ value: "", label: "Server default" }, ...LENGTH_OPTIONS]}
              value={form.length ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  length: (e.target.value || undefined) as SettingsDTO["length"],
                }))
              }
            />
          </div>
        )}

        <CardFooter className="justify-between">
          <p className="text-sm text-gray-500">{isDirty ? "Unsaved changes" : "Up to date"}</p>
          <Button onClick={handleSave} loading={saving} disabled={loadingSettings || !!loadError}>
            Save defaults
          </Button>
        </CardFooter>
      </Card>

      {/* Danger zone — explicit confirmation required before any destructive action. */}
      <Card className="border-error-200">
        <CardHeader>
          <CardTitle className="text-error-700">Danger zone</CardTitle>
        </CardHeader>
        <CardDescription>
          Permanently delete every generated post and its poster image. This cannot be undone.
        </CardDescription>
        <CardFooter className="justify-end">
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Delete all posts
          </Button>
        </CardFooter>
      </Card>

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!deleting) {
            setConfirmOpen(false);
            setConfirmText("");
          }
        }}
        title="Delete all posts?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteAllPosts()}
              disabled={!confirmValid}
              loading={deleting}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            This permanently deletes every post and its poster image from the database. This
            action cannot be undone.
          </p>
          <Input
            label='Type "DELETE" to confirm'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}
