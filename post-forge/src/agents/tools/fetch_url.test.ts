/**
 * `fetch_url` tool tests (T18 BRD §4.3): the SSRF guard and the
 * graceful-degradation paths.
 *
 * Per the BRD, the SSRF guard itself needs no mocking (it's pure
 * hostname/IP logic that throws before any `fetch` call) -- exercised here
 * with synthetic private/loopback/link-local IPs and a `file:` URL. The
 * BRD also suggested hitting a real `httpbin.org` for the non-HTTP
 * degradation case; this suite instead mocks `global.fetch` for every
 * network-touching path (see the DoD's "zero network access" requirement
 * in the T18 brief) while still exercising the exact same response-shape
 * branches (`content-type`, `content-length`, byte cap, JSDOM/Readability
 * extraction, truncation).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

// Mock DNS resolution so the "hostname (not a literal IP) resolves to a
// private address" branch of the SSRF guard is exercised deterministically,
// without a real DNS lookup.
vi.mock("node:dns/promises", () => ({
  default: {
    lookup: vi.fn(async (hostname: string) => {
      if (hostname === "internal.example.test") {
        return [{ address: "10.1.2.3", family: 4 }];
      }
      if (hostname === "public.example.test") {
        return [{ address: "93.184.216.34", family: 4 }];
      }
      throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    }),
  },
}));

import { fetchUrlTool, SsrfBlockedError } from "./fetch_url";

async function callTool(input: { url: string }) {
  return (fetchUrlTool.handler as (args: unknown, ctx: unknown) => Promise<unknown>)(
    input,
    {}
  );
}

const READABLE_HTML = `<!doctype html><html><head><title>A Real Article</title></head>
<body><article><h1>A Real Article</h1>
<p>${"This is a substantial paragraph of readable article content. ".repeat(20)}</p>
<p>${"Here is a second paragraph so Readability has enough text to extract. ".repeat(20)}</p>
</article></body></html>`;

function htmlResponse(body: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", ...extraHeaders },
  });
}

describe("fetch_url tool -- SSRF guard (no mocking needed, pure logic)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const privateLiteralIps = [
    "http://127.0.0.1/",
    "http://169.254.169.254/latest/meta-data/", // cloud metadata endpoint
    "http://10.0.0.5/",
    "http://192.168.1.1/",
    "http://172.16.0.5/",
    "http://0.0.0.0/",
    "http://[::1]/",
  ];

  it.each(privateLiteralIps)("blocks literal private/loopback/link-local IP: %s", async (url) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(callTool({ url })).rejects.toThrow(SsrfBlockedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks the localhost hostname", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(callTool({ url: "http://localhost:9999/" })).rejects.toThrow(SsrfBlockedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks non-http(s) schemes (e.g. file://)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(callTool({ url: "file:///etc/passwd" })).rejects.toThrow(SsrfBlockedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks a hostname that resolves (via DNS) to a private IP", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(callTool({ url: "http://internal.example.test/" })).rejects.toThrow(
      SsrfBlockedError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does NOT block a hostname that resolves to a public IP", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(READABLE_HTML)));
    const result = (await callTool({ url: "http://public.example.test/" })) as { ok: boolean };
    expect(result.ok).toBe(true);
  });
});

describe("fetch_url tool -- graceful degradation (fetch mocked, zero network access)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts readable text from a normal HTML page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(READABLE_HTML)));
    const result = (await callTool({ url: "https://example.com/article" })) as {
      ok: true;
      title?: string;
      text: string;
      truncated: boolean;
    };
    expect(result.ok).toBe(true);
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.text).toContain("substantial paragraph");
    expect(result.truncated).toBe(false);
  });

  it("degrades gracefully (ok:false, no throw) on a non-HTML content-type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ hello: "world" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );
    const result = (await callTool({ url: "https://example.com/data.json" })) as {
      ok: false;
      reason: string;
    };
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/non-HTML content-type/);
  });

  it("degrades gracefully on an HTTP error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 404 })));
    const result = (await callTool({ url: "https://example.com/missing" })) as {
      ok: false;
      reason: string;
    };
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("HTTP 404");
  });

  it("degrades gracefully when content-length exceeds the byte cap", async () => {
    const tooLarge = 6 * 1024 * 1024; // > 5MB cap
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(READABLE_HTML, { "content-length": String(tooLarge) })
      )
    );
    const result = (await callTool({ url: "https://example.com/huge" })) as {
      ok: false;
      reason: string;
    };
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/too large/);
  });

  it("degrades gracefully when fetch itself throws (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const result = (await callTool({ url: "https://example.com/down" })) as {
      ok: false;
      reason: string;
    };
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/fetch failed/);
  });

  it("truncates text longer than the 10,000-char cap and flags truncated:true", async () => {
    const longParagraph = "Word ".repeat(4000); // ~20,000 chars of readable text
    const html = `<!doctype html><html><head><title>Long</title></head><body><article><h1>Long</h1><p>${longParagraph}</p></article></body></html>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(html)));
    const result = (await callTool({ url: "https://example.com/long" })) as {
      ok: true;
      text: string;
      truncated: boolean;
    };
    expect(result.ok).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBe(10_000);
  });
});
