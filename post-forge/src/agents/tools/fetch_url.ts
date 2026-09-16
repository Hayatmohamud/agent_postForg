/**
 * `fetch_url` AgentKit tool — fetches a page and extracts readable text.
 *
 * Used by the Research agent (T04) to pull the body of a search result.
 * Degrades gracefully (returns a short structured note) rather than
 * throwing on non-HTML/oversized/unreachable pages, since a single bad
 * source shouldn't fail the whole run. The SSRF guard, by contrast, is a
 * hard block — it throws.
 *
 * `parameters` deliberately uses a plain `z.string()` rather than
 * `z.url()`/`z.string().url()`: those emit a `format:"uri"` JSON-schema
 * constraint that some strict function-calling providers reject outright
 * (see tasks/README.md "Known pitfalls"). The URL is validated manually
 * at runtime instead.
 */

import dns from "node:dns/promises";
import net from "node:net";
import { createTool } from "@inngest/agent-kit";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { z } from "zod";

const FETCH_TIMEOUT_MS = 8_000;
const MAX_BYTES = 5 * 1024 * 1024; // 5MB raw body cap
const MAX_TEXT_CHARS = 10_000;

export type FetchUrlResult =
  | { ok: true; url: string; title?: string; text: string; truncated: boolean }
  | { ok: false; url: string; reason: string };

export class SsrfBlockedError extends Error {
  constructor(url: string) {
    super(`SsrfBlockedError: refusing to fetch blocked/private host for URL: ${url}`);
    this.name = "SsrfBlockedError";
  }
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 0) return true; // "this network"
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true; // loopback
  if (lower === "::") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true; // fe80::/10 link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 unique local
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.split(":").pop() ?? "";
    if (net.isIP(v4) === 4) return isPrivateIPv4(v4);
  }
  return false;
}

/** Returns true if `hostname` is (or resolves to) a private/loopback/link-local address. */
async function isBlockedHost(hostname: string): Promise<boolean> {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) return true;

  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4) return isPrivateIPv4(hostname);
  if (ipVersion === 6) return isPrivateIPv6(hostname);

  // Not a literal IP — resolve DNS and check every returned address so a
  // hostname that simply points at a private IP is caught too.
  try {
    const records = await dns.lookup(hostname, { all: true });
    if (records.length === 0) return false;
    return records.some((r) =>
      r.family === 4 ? isPrivateIPv4(r.address) : isPrivateIPv6(r.address)
    );
  } catch {
    // Unresolvable — not our job to block; the fetch itself will fail.
    return false;
  }
}

async function guardUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch (err) {
    throw new Error(`invalid URL: ${rawUrl}`, { cause: err });
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SsrfBlockedError(rawUrl);
  }

  if (await isBlockedHost(parsed.hostname)) {
    throw new SsrfBlockedError(rawUrl);
  }

  return parsed;
}

export const fetchUrlTool = createTool({
  name: "fetch_url",
  description:
    "Fetches a web page and extracts its main readable text (capped length). Degrades gracefully with a structured note on non-HTML/oversized/unreachable pages.",
  parameters: z.object({ url: z.string() }),
  handler: async ({ url }): Promise<FetchUrlResult> => {
    // SSRF guard: hard-blocks private/loopback/link-local/metadata hosts.
    // This is a real security control, not a soft-fail path, so it throws.
    const parsed = await guardUrl(url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": "PostForgeBot/1.0 (+https://postforge.local)",
        },
      });
    } catch (err) {
      return {
        ok: false,
        url,
        reason: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      return { ok: false, url, reason: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return { ok: false, url, reason: `non-HTML content-type: ${contentType || "unknown"}` };
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      return { ok: false, url, reason: `response too large (${contentLength} bytes)` };
    }

    let html: string;
    try {
      // Enforce the size cap even when content-length is absent/lied about.
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) {
        return { ok: false, url, reason: `response too large (${buf.byteLength} bytes)` };
      }
      html = Buffer.from(buf).toString("utf-8");
    } catch (err) {
      return {
        ok: false,
        url,
        reason: `failed to read response body: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    try {
      const dom = new JSDOM(html, { url: parsed.toString() });
      const article = new Readability(dom.window.document).parse();
      const text = (article?.textContent ?? "").trim();
      if (!text) {
        return { ok: false, url, reason: "no readable content extracted" };
      }
      const truncated = text.length > MAX_TEXT_CHARS;
      return {
        ok: true,
        url,
        title: article?.title ?? undefined,
        text: truncated ? text.slice(0, MAX_TEXT_CHARS) : text,
        truncated,
      };
    } catch (err) {
      return {
        ok: false,
        url,
        reason: `extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});
