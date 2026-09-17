"use client";

import { useRouter } from "next/navigation";
import type { PostSummary } from "@/lib/dto";
import { Card, StatusBadge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { PosterThumb } from "./PosterThumb";

export interface PostRowProps {
  post: PostSummary;
}

/** List-view row for the Library (T13): small poster thumb, title/topic, status, date. Click navigates to the post detail (T12). */
export function PostRow({ post }: PostRowProps) {
  const router = useRouter();
  const title = post.title || post.topic;

  return (
    <Card
      noPadding
      interactive
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/posts/${post.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/posts/${post.id}`);
        }
      }}
      className="flex items-center gap-4 overflow-hidden p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      aria-label={`Open post: ${title}`}
    >
      <PosterThumb posterImageId={post.posterImageId} alt={title} className="h-14 w-14 shrink-0" />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-gray-900">{title}</h3>
        {post.title && <p className="truncate text-xs text-gray-500">{post.topic}</p>}
      </div>
      <StatusBadge status={post.status} className="shrink-0" />
      <span className="w-24 shrink-0 text-right text-xs text-gray-400">{formatDate(post.updatedAt)}</span>
    </Card>
  );
}
