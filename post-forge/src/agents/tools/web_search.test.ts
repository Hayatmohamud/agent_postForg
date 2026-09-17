/**
 * `web_search` tool tests (T18 BRD §4.3): result normalization + error
 * paths, with the Serper HTTP call mocked via `vi.stubGlobal("fetch", ...)`
 * -- no live SERPER_API_KEY or network access required.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { webSearchTool, WebSearchError } from "./web_search";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function callTool(input: { query: string }) {
  // AgentKit tool handlers take (args, toolContext); no test in this suite
  // needs the second arg for web_search, so an empty object stands in.
  return (webSearchTool.handler as (args: unknown, ctx: unknown) => Promise<unknown>)(
    input,
    {}
  );
}

describe("web_search tool", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("normalizes Serper's organic results to {title,url,snippet}, capped at 8", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key");
    const organic = Array.from({ length: 12 }, (_, i) => ({
      title: `Result ${i}`,
      link: `https://example.com/${i}`,
      snippet: `snippet ${i}`,
    }));
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ organic }));
    vi.stubGlobal("fetch", fetchMock);

    const results = (await callTool({ query: "world cup 2026" })) as {
      title: string;
      url: string;
      snippet: string;
    }[];

    expect(results).toHaveLength(8);
    expect(results[0]).toEqual({
      title: "Result 0",
      url: "https://example.com/0",
      snippet: "snippet 0",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://google.serper.dev/search");
    expect((init.headers as Record<string, string>)["X-API-KEY"]).toBe("test-key");
    expect(JSON.parse(init.body as string)).toEqual({ q: "world cup 2026" });
  });

  it("fills missing title/link/snippet fields with empty strings", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ organic: [{}] }))
    );
    const results = (await callTool({ query: "q" })) as { title: string; url: string; snippet: string }[];
    expect(results).toEqual([{ title: "", url: "", snippet: "" }]);
  });

  it("returns an empty array when Serper's response has no organic field", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));
    const results = await callTool({ query: "q" });
    expect(results).toEqual([]);
  });

  it("throws a named WebSearchError when SERPER_API_KEY is missing (no network call made)", async () => {
    delete process.env.SERPER_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(callTool({ query: "q" })).rejects.toThrow(WebSearchError);
    await expect(callTool({ query: "q" })).rejects.toThrow(/missing SERPER_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a named WebSearchError on a non-200 Serper response", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }))
    );
    await expect(callTool({ query: "q" })).rejects.toThrow(WebSearchError);
    await expect(callTool({ query: "q" })).rejects.toThrow(/status 429/);
  });

  it("throws a named WebSearchError when fetch itself rejects (network error)", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    await expect(callTool({ query: "q" })).rejects.toThrow(WebSearchError);
    await expect(callTool({ query: "q" })).rejects.toThrow(/network error calling Serper/);
  });

  it("throws a named WebSearchError when the response body isn't valid JSON", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("not json", { status: 200, headers: { "content-type": "text/plain" } })
      )
    );
    await expect(callTool({ query: "q" })).rejects.toThrow(WebSearchError);
    await expect(callTool({ query: "q" })).rejects.toThrow(/failed to parse Serper response/);
  });
});
