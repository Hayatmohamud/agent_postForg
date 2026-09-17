/**
 * `GET /api/posters/[id]` (T06 BRD 4.4): streams poster image bytes
 * straight from the `posters` GridFS bucket, with `Content-Type` read from
 * the file's `metadata.mime` (written by the `generate_poster` tool, T03)
 * and long-lived immutable caching (poster bytes for a given id never
 * change once generated). Cleanly 404s for an unknown/invalid id instead
 * of leaking a raw GridFS "FileNotFound" error.
 */

import { NextResponse, type NextRequest } from "next/server";
import { ObjectId, GridFSFile } from "mongodb";
import { getBucket } from "@/lib/mongo";
import { errorResponse } from "@/lib/http";

type RouteContext = { params: Promise<{ id: string }> };

/** Node `Readable` -> web `ReadableStream`, so it can back a `Response` body. */
function toWebStream(nodeStream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      if (typeof (nodeStream as NodeJS.ReadableStream & { destroy?: () => void }).destroy === "function") {
        (nodeStream as NodeJS.ReadableStream & { destroy: () => void }).destroy();
      }
    },
  });
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;

  if (!ObjectId.isValid(id)) {
    return errorResponse(404, `No poster found with id "${id}"`, "not_found");
  }

  const objectId = new ObjectId(id);

  try {
    const bucket = await getBucket();

    const files = await bucket.find({ _id: objectId }).toArray();
    const file = files[0] as GridFSFile | undefined;
    if (!file) {
      return errorResponse(404, `No poster found with id "${id}"`, "not_found");
    }

    const mime =
      (file.metadata as { mime?: string } | undefined)?.mime ?? "application/octet-stream";

    const downloadStream = bucket.openDownloadStream(objectId);
    const body = toWebStream(downloadStream);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(file.length),
        // Poster bytes are immutable once generated (a given GridFS id
        // never changes content), so a long-lived immutable cache is safe.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to stream poster";
    return errorResponse(500, message, "get_poster_failed");
  }
}
