/**
 * `GET /api/posts` (T06 BRD 4.2): lists posts with optional `search`
 * (topic full-text search), `status` filter, `from`/`to` date-range
 * filter, and `page`/`pageSize` offset pagination — delegating the query
 * itself to `listPosts` (T02) and projecting each result to the
 * lightweight `PostSummary` DTO.
 */

import { NextResponse, type NextRequest } from "next/server";
import { listPosts, type ListPostsQuery } from "@/lib/posts-repo";
import { toPostSummary, type PostListResponse } from "@/lib/dto";
import type { PostStatus } from "@/lib/state";
import { errorResponse } from "@/lib/http";

const VALID_STATUSES: readonly PostStatus[] = [
  "researching",
  "verifying",
  "writing",
  "editing",
  "illustrating",
  "publishing",
  "done",
  "failed",
];

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const statusParam = params.get("status");
  if (statusParam && !VALID_STATUSES.includes(statusParam as PostStatus)) {
    return errorResponse(
      400,
      `Invalid status "${statusParam}". Must be one of: ${VALID_STATUSES.join(", ")}`,
      "invalid_status"
    );
  }

  const query: ListPostsQuery = {
    search: params.get("search") ?? undefined,
    status: statusParam ? (statusParam as PostStatus) : undefined,
    from: parseDate(params.get("from")),
    to: parseDate(params.get("to")),
    page: parsePositiveInt(params.get("page")),
    pageSize: parsePositiveInt(params.get("pageSize")),
  };

  try {
    const result = await listPosts(query);
    const response: PostListResponse = {
      items: result.items.map(toPostSummary),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list posts";
    return errorResponse(500, message, "list_posts_failed");
  }
}
