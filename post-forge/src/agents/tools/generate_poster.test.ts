/**
 * `generate_poster` tool tests (T18 BRD §4.3): the OpenRouter image call is
 * mocked (`@/lib/image`'s `generatePoster`); GridFS is exercised against a
 * minimal in-memory fake bucket (see the Mongo-strategy note in
 * `src/lib/posts-repo.test.ts` / `tasks/reports.jsonl` for why this suite
 * doesn't spin up `mongodb-memory-server`) that mimics the exact
 * `openUploadStream(...).end(bytes)` write-stream contract the tool
 * actually calls, so the upload path is genuinely exercised end-to-end
 * rather than a bare mock of the tool's own return value.
 */

import { describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

vi.mock("@/lib/image", () => ({
  generatePoster: vi.fn(),
}));

// A fake GridFSBucket exposing just `openUploadStream`, matching the real
// bucket's write-stream API (`once("error"|"finish", cb)`, `.end(bytes)`,
// `.id`) that generate_poster.ts's uploadToGridFs() actually relies on.
class FakeUploadStream {
  id = new ObjectId();
  handlers: Record<string, ((...args: unknown[]) => void)[]> = {};
  metadata: unknown;
  filename: string;
  written: Buffer | undefined;
  failWith: Error | undefined;

  constructor(filename: string, options: { metadata?: unknown }, failWith?: Error) {
    this.filename = filename;
    this.metadata = options.metadata;
    this.failWith = failWith;
  }

  once(event: string, cb: (...args: unknown[]) => void) {
    (this.handlers[event] ??= []).push(cb);
    return this;
  }

  end(bytes: Buffer) {
    this.written = bytes;
    // Simulate the real driver's async finish/error.
    queueMicrotask(() => {
      if (this.failWith) {
        for (const cb of this.handlers.error ?? []) cb(this.failWith);
      } else {
        for (const cb of this.handlers.finish ?? []) cb();
      }
    });
  }
}

const uploadedStreams: FakeUploadStream[] = [];

vi.mock("@/lib/mongo", () => ({
  getBucket: vi.fn(async () => ({
    openUploadStream: (filename: string, options: { metadata?: unknown }) => {
      const stream = new FakeUploadStream(filename, options);
      uploadedStreams.push(stream);
      return stream;
    },
  })),
}));

import { generatePosterTool, GeneratePosterToolError } from "./generate_poster";
import { generatePoster } from "@/lib/image";

function fakeNetwork(state: Record<string, unknown>) {
  return { network: { state: { data: state } } };
}

describe("generate_poster tool", () => {
  it("stores the generated image bytes+mime in GridFS and returns the file id", async () => {
    uploadedStreams.length = 0;
    const bytes = Buffer.from("fake-png-bytes");
    vi.mocked(generatePoster).mockResolvedValue({ bytes, mime: "image/png" });

    const ctx = fakeNetwork({ postId: "post-123", options: { imageModel: "some/model" } });
    const result = (await (
      generatePosterTool.handler as (args: unknown, ctx: unknown) => Promise<unknown>
    )({ prompt: "a red circle poster" }, ctx)) as { posterImageId: string };

    expect(generatePoster).toHaveBeenCalledWith("a red circle poster", "some/model");
    expect(uploadedStreams).toHaveLength(1);
    expect(uploadedStreams[0].written?.toString()).toBe("fake-png-bytes");
    expect(uploadedStreams[0].metadata).toEqual({ mime: "image/png", postId: "post-123" });
    expect(result.posterImageId).toBe(uploadedStreams[0].id.toString());

    // The tool also mutates network state directly (per its own doc-comment).
    expect((ctx.network.state.data as { posterImageId?: string }).posterImageId).toBe(
      result.posterImageId
    );
  });

  it("wraps an image-generation failure in a named GeneratePosterToolError", async () => {
    vi.mocked(generatePoster).mockRejectedValue(new Error("OpenRouter 500"));
    const ctx = fakeNetwork({});
    await expect(
      (generatePosterTool.handler as (args: unknown, ctx: unknown) => Promise<unknown>)(
        { prompt: "x" },
        ctx
      )
    ).rejects.toThrow(GeneratePosterToolError);
  });

  it("wraps a GridFS upload failure in a named GeneratePosterToolError", async () => {
    vi.mocked(generatePoster).mockResolvedValue({
      bytes: Buffer.from("bytes"),
      mime: "image/png",
    });
    const { getBucket } = await import("@/lib/mongo");
    vi.mocked(getBucket).mockResolvedValueOnce({
      openUploadStream: (filename: string, options: { metadata?: unknown }) =>
        new FakeUploadStream(filename, options, new Error("disk full")),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const ctx = fakeNetwork({});
    await expect(
      (generatePosterTool.handler as (args: unknown, ctx: unknown) => Promise<unknown>)(
        { prompt: "x" },
        ctx
      )
    ).rejects.toThrow(GeneratePosterToolError);
  });
});
