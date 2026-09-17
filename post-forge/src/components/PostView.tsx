"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SourceCitationChip } from "@/components/pipeline";
import { Badge, Button, Card, EmptyState, Modal, StatusBadge, useToast } from "@/components/ui";
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

  const paragraphs = useMemo(() => paragraphsOf(post.finalPost), [post.finalPost]);
  const sourcesWithVerification = useMemo(
    () => computeSourceVerification(post.sources, post.verifiedFindings),
    [post.sources, post.verifiedFindings],
  );
  const generationMs = stageElapsedMs(post.createdAt, post.updatedAt, Date.now());
  const posterUrl = post.posterImageId ? `/api/posters/${post.posterImageId}` : undefined;
  const title = post.title || post.topic;

  async function handleCopy() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(post.finalPost ?? "");
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
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={post.status} />
          <Badge tone="neutral">
            <span className="font-mono">{formatTimestamp(post.createdAt)}</span>
          </Badge>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{title}</h1>
      </header>

      {posterUrl && (
        <img
          src={posterUrl}
          alt={title}
          className="w-full rounded-[var(--radius-xl)] border border-border object-cover shadow-[var(--shadow-sm)]"
        />
      )}

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

      <Card>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Sources</h2>
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

      <Card>
        <h2 className="mb-3 text-base font-semibold text-gray-900">Details</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Model</dt>
            <dd className="font-mono text-gray-900">{post.options.model ?? "default"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Image model</dt>
            <dd className="font-mono text-gray-900">{post.options.imageModel ?? "default"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Generation time</dt>
            <dd className="text-gray-900">
              {generationMs !== undefined ? formatElapsed(generationMs) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Created</dt>
            <dd className="text-gray-900">{formatTimestamp(post.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Last updated</dt>
            <dd className="text-gray-900">{formatTimestamp(post.updatedAt)}</dd>
          </div>
        </dl>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={handleCopy} loading={copying} disabled={!post.finalPost}>
          Copy
        </Button>
        {posterUrl && (
          <a href={posterUrl} download={`${slugify(title)}-poster.png`}>
            <Button variant="secondary">Download poster</Button>
          </a>
        )}
        <Button variant="secondary" onClick={handleRegenerate} loading={regenerating}>
          Regenerate
        </Button>
        <Button
          variant="destructive"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={deleting}
        >
          Delete
        </Button>
      </div>

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
