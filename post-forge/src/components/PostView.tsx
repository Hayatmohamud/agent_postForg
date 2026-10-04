"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SourceCitationChip } from "@/components/pipeline";
import { Badge, Button, Card, EmptyState, Input, Modal, StatusBadge, Textarea, useToast } from "@/components/ui";
import { formatElapsed, stageElapsedMs } from "@/lib/duration";
import type { ErrorResponse, GenerateBlockedResponse, GenerateResponse, PostDetail } from "@/lib/dto";

export interface PostViewProps {
  post: PostDetail;
}

/** Builds a filesystem-safe filename slug from a post title/topic. */
function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "post";
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/**
 * A single cited source paired with its computed verification state, derived
 * by matching `post.sources` (title+url only) against `post.verifiedFindings`
 * (claim + source + verified) on `source.url`.
 *
 * A source can be referenced by more than one claim/finding — treated as
 * verified overall if *any* matching finding was verified, since the source
 * itself did check out at least once. A source with no matching finding at
 * all (verifiedFindings didn't happen to cite it, e.g. it was only used for
 * background research) gets `verified: undefined` — the chip then shows the
 * neutral "unknown" dot rather than a misleading Unverified label.
 */
function computeSourceVerification(
  sources: PostDetail["sources"],
  verifiedFindings: PostDetail["verifiedFindings"],
): Array<{ title: string; url: string; verified: boolean | undefined }> {
  return sources.map((source) => {
    const matches = verifiedFindings.filter((finding) => finding.source.url === source.url);
    if (matches.length === 0) return { ...source, verified: undefined };
    const verified = matches.some((finding) => finding.verified);
    return { ...source, verified };
  });
}

/** Splits `finalPost` into paragraph blocks for editorial-typography rendering. */
function paragraphsOf(finalPost: string | undefined): string[] {
  if (!finalPost) return [];
  return finalPost
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * The finished-article view (T12, DESIGN_PROMPT.md screen 7): rendered by
 * `posts/[id]/page.tsx` once `status === "done"`. Renders the title, hero
 * poster, body in editorial typography, a Sources section with per-claim
 * verification, generation metadata, and the copy/download/regenerate/delete
 * actions.
 */
export function PostView({ post }: PostViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [copying, setCopying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Local overrides so a saved edit shows immediately, without waiting on the
  // next poll from usePostPolling (the parent owns the actual `post` prop).
  const [overrideTitle, setOverrideTitle] = useState<string | undefined>(undefined);
  const [overrideBody, setOverrideBody] = useState<string | undefined>(undefined);
  const effectiveTitle = overrideTitle ?? post.title;
  const effectiveBody = overrideBody ?? post.finalPost;

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);

  const paragraphs = useMemo(() => paragraphsOf(effectiveBody), [effectiveBody]);
  const sourcesWithVerification = useMemo(
    () => computeSourceVerification(post.sources, post.verifiedFindings),
    [post.sources, post.verifiedFindings],
  );
  // `post` is always "done" here, so `updatedAt` is always set and
  // `stageElapsedMs`'s third arg (a live "now" fallback for an in-progress
  // stage) is never actually used — pass a deterministic value instead of
  // `Date.now()`, which the "no impure calls during render" rule flags.
  const generationMs = stageElapsedMs(
    post.createdAt,
    post.updatedAt,
    new Date(post.updatedAt).getTime(),
  );
  const posterUrl = post.posterImageId ? `/api/posters/${post.posterImageId}` : undefined;
  const title = effectiveTitle || post.topic;

  function startEditing() {
    setEditTitle(title);
    setEditBody(effectiveBody ?? "");
    setEditing(true);
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), finalPost: editBody }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ErrorResponse | null;
        throw new Error(body?.error?.message ?? `Request failed with status ${res.status}`);
      }
      setOverrideTitle(editTitle.trim());
      setOverrideBody(editBody);
      setEditing(false);
      toast({ title: "Post updated", tone: "success" });
    } catch (err) {
      toast({
        title: "Couldn't save changes",
        description: err instanceof Error ? err.message : "Something went wrong.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(effectiveBody ?? "");
      toast({ title: "Copied to clipboard", tone: "success" });
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Your browser blocked clipboard access.",
        tone: "error",
      });
    } finally {
      setCopying(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: post.topic, options: post.options }),
      });

      if (res.status === 429) {
        const body = (await res.json().catch(() => null)) as GenerateBlockedResponse | null;
        toast({
          title: "Couldn't start a new run",
          description: body?.error?.message ?? "This topic is already running or was blocked.",
          tone: "warning",
        });
        return;
      }

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ErrorResponse | null;
        throw new Error(body?.error?.message ?? `Request failed with status ${res.status}`);
      }

      const body = (await res.json()) as GenerateResponse;
      router.push(`/posts/${body.id}`);
    } catch (err) {
      toast({
        title: "Couldn't start a new run",
        description: err instanceof Error ? err.message : "Something went wrong.",
        tone: "error",
      });
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as ErrorResponse | null;
        throw new Error(body?.error?.message ?? `Request failed with status ${res.status}`);
      }
      router.push("/library");
    } catch (err) {
      toast({
        title: "Couldn't delete this post",
        description: err instanceof Error ? err.message : "Something went wrong.",
        tone: "error",
      });
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-6">
        {posterUrl ? (
          <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-border shadow-[var(--shadow-sm)]">
            <img src={posterUrl} alt={title} className="w-full object-cover" />
          </div>
        ) : (
          <div className="rounded-[var(--radius-xl)] border border-border bg-[#0b1210] px-6 py-10 text-white">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-white/60">PostForge &middot; {new Date(post.createdAt).getFullYear()}</p>
            <h2 className="mt-3 font-serif text-2xl">{title}</h2>
          </div>
        )}

        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={post.status} />
            <Badge tone="neutral">
              <span className="font-mono">{formatTimestamp(post.createdAt)}</span>
            </Badge>
          </div>
          {editing ? (
            <Input
              label="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-xl font-semibold"
            />
          ) : (
            <h1 className="text-3xl font-semibold tracking-tight text-text">{title}</h1>
          )}
          <p className="font-mono text-xs uppercase tracking-wide text-gray-500">
            {formatTimestamp(post.createdAt)} &middot; {post.options.model ?? "default model"}
          </p>
        </header>

        {editing ? (
          <div className="space-y-3">
            <Textarea
              label="Article body"
              hint="Separate paragraphs with a blank line."
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={16}
              className="font-serif text-base leading-relaxed"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} loading={saving} disabled={!editTitle.trim()}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <article className="font-serif text-lg leading-relaxed text-gray-800">
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph, i) => (
                <p key={i} className="mb-5 last:mb-0">
                  {paragraph}
                </p>
              ))
            ) : (
              <p className="font-sans text-sm text-gray-500">No article body was generated for this post.</p>
            )}
          </article>
        )}

        <Card>
          <h2 className="mb-3 text-base font-semibold text-text">Sources</h2>
          {sourcesWithVerification.length > 0 ? (
            <div className="flex flex-col gap-2">
              {sourcesWithVerification.map((source) => (
                <SourceCitationChip
                  key={source.url}
                  title={source.title}
                  url={source.url}
                  verified={source.verified}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No sources" description="This post didn't cite any external sources." />
          )}
        </Card>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20">
        <Card>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={startEditing} disabled={editing}>
              Edit
            </Button>
            <Button onClick={handleCopy} loading={copying} disabled={!effectiveBody}>
              Copy
            </Button>
            {posterUrl ? (
              <a href={posterUrl} download={`${slugify(title)}-poster.png`}>
                <Button variant="secondary" fullWidth>
                  Poster
                </Button>
              </a>
            ) : (
              <Button variant="secondary" disabled>
                Poster
              </Button>
            )}
            <Button variant="secondary" onClick={handleRegenerate} loading={regenerating}>
              Regenerate
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleting}
              className="col-span-2"
            >
              Delete
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-wide text-gray-500">
            Generation metadata
          </h2>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Model</dt>
              <dd className="font-mono text-text">{post.options.model ?? "default"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Image model</dt>
              <dd className="truncate font-mono text-text">{post.options.imageModel ?? "default"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Generation time</dt>
              <dd className="text-text">{generationMs !== undefined ? formatElapsed(generationMs) : "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Created</dt>
              <dd className="text-text">{formatTimestamp(post.createdAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Last updated</dt>
              <dd className="text-text">{formatTimestamp(post.updatedAt)}</dd>
            </div>
          </dl>
        </Card>
      </aside>

      <Modal
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Delete this post?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">
          This permanently deletes &ldquo;{title}&rdquo; and its poster image. This can&apos;t be undone.
        </p>
      </Modal>
    </div>
  );
}
