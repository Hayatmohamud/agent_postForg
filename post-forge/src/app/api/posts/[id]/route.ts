/**
 * `GET/DELETE /api/posts/[id]` (T06 BRD 4.3): `GET` returns the poll shape
 * (`PostDetail`) a client repeatedly polls during a run to see live
 * `status`/`stages`/`subProgress`, plus the full payload fields
 * (`finalPost`, `sources`, `title`, `posterImageId`, `telemetry`) which are
 * simply unset until their stage completes. `DELETE` removes the post doc
 * AND its GridFS poster bytes (BRD's explicit "avoid orphans" risk note),
 * best-effort on the GridFS side so a missing/already-gone poster file
 * never blocks deleting the post record.
 */

import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getPostById } from "@/lib/posts-repo";
import { getDb, getBucket } from "@/lib/mongo";
import { toPostDetail, type PostDetail } from "@/lib/dto";
import { errorResponse } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };

function isValidObjectId(id: string): boolean {
  return ObjectId.isValid(id);
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  if (!isValidObjectId(id)) {
    return errorResponse(400, `"${id}" is not a valid post id`, "invalid_id");
  }

  try {
    const post = await getPostById(id);
    if (!post) {
      return errorResponse(404, `No post found with id "${id}"`, "not_found");
    }
    const response: PostDetail = toPostDetail(post);
    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch post";
    return errorResponse(500, message, "get_post_failed");
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  if (!isValidObjectId(id)) {
    return errorResponse(400, `"${id}" is not a valid post id`, "invalid_id");
  }

  try {
    const post = await getPostById(id);
    if (!post) {
      return errorResponse(404, `No post found with id "${id}"`, "not_found");
    }

    if (post.posterImageId && ObjectId.isValid(post.posterImageId)) {
      try {
        const bucket = await getBucket();
        await bucket.delete(new ObjectId(post.posterImageId));
      } catch {
        // Best-effort: an already-missing/corrupt GridFS file must never
        // block deleting the post record itself.
      }
    }

    const db = await getDb();
    await db.collection("posts").deleteOne({ _id: post._id });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete post";
    return errorResponse(500, message, "delete_post_failed");
  }
}
