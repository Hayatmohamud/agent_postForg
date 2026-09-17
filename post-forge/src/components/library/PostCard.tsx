"use client";

import { useRouter } from "next/navigation";
import type { PostSummary } from "@/lib/dto";
import { Card, StatusBadge } from "@/components/ui";
import { formatRelativeTime } from "@/lib/format";
import { PosterThumb } from "./PosterThumb";

export interface PostCardProps {
  post: PostSummary;
}

/** Grid-view card for the Library (T13): poster, title/topic, status, date. Click navigates to the post detail (T12). */
export function PostCard({ post }: PostCardProps) {
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
      className="flex flex-col overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      aria-label={`Open post: ${title}`}
    >
      <PosterThumb posterImageId={post.posterImageId} alt={title} className="aspect-[4/3] w-full shrink-0" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        {post.title && <p className="line-clamp-1 text-xs text-gray-500">{post.topic}</p>}
        <div className="mt-auto flex items-center justify-between pt-1">
          <StatusBadge status={post.status} />
          <span className="text-xs text-gray-400">{formatRelativeTime(post.updatedAt)}</span>
        </div>
      </div>
    </Card>
  );
}
