"use client";

import { useState } from "react";
import { Button, Modal, useToast } from "@/components/ui";

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0v9.5A1.5 1.5 0 0 1 12.5 17h-5A1.5 1.5 0 0 1 6 15.5V6h8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface DeletePostButtonProps {
  postId: string;
  title: string;
  /** Called after a successful delete so the caller can remove it from the list / refetch. */
  onDeleted: () => void;
  className?: string;
}

/** Small icon-button + confirm modal, used on Library's grid/list post items. */
export function DeletePostButton({ postId, title, onDeleted, className }: DeletePostButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Request failed with status ${res.status}`);
      }
      setOpen(false);
      toast({ title: "Post deleted", tone: "success" });
      onDeleted();
    } catch (err) {
      toast({
        title: "Couldn't delete this post",
        description: err instanceof Error ? err.message : "Something went wrong.",
        tone: "error",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Delete ${title}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-gray-400 hover:bg-error-50 hover:text-error-600 " +
          (className ?? "")
        }
      >
        <TrashIcon />
      </button>
      <Modal
        open={open}
        onClose={() => !deleting && setOpen(false)}
        title="Delete this post?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>
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
    </>
  );
}
