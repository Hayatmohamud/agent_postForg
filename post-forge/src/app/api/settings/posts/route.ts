/**
 * `DELETE /api/settings/posts` (T15 BRD 4/req.1 "danger zone"): permanently
 * deletes every post document and its GridFS poster bytes. This lives under
 * `/api/settings/*` (rather than adding a bulk-delete method to the shared
 * `/api/posts` route owned by T06/T10) so this destructive, settings-only
 * action stays exclusively in T15's file surface. Requires no body; the
 * Settings page gates the call behind an explicit confirm modal (T07's
 * `Modal`) — this route itself performs no additional confirmation, by
 * design, since HTTP has no notion of "the user already confirmed."
 */

import { NextResponse } from "next/server";
import { deleteAllPosts } from "@/lib/posts-repo";
import { errorResponse } from "@/lib/http";

export async function DELETE() {
  try {
    const { deletedCount } = await deleteAllPosts();
    return NextResponse.json({ ok: true, deletedCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete posts";
    return errorResponse(500, message, "delete_all_posts_failed");
  }
}
