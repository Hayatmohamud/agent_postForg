/**
 * `web_search` AgentKit tool — Serper.dev web search.
 *
 * Used by the Research and Verify agents (T04) to find/cross-check sources.
 * Throws a clearly-named error on a missing key or a non-200 response so
 * the orchestrator (T05) can decide retry vs. fail rather than silently
 * getting an empty result set.
 */

import { createTool } from "@inngest/agent-kit";
import { z } from "zod";
import { requireEnv } from "@/lib/env";

const SERPER_SEARCH_URL = "https://google.serper.dev/search";
const MAX_RESULTS = 8;

export type WebSearchResult = { title: string; url: string; snippet: string };

export class WebSearchError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(`WebSearchError: ${message}`);
    this.name = "WebSearchError";
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

type SerperResponse = {
  organic?: { title?: string; link?: string; snippet?: string }[];
};

export const webSearchTool = createTool({
  name: "web_search",
  description:
    "Search the web via Serper.dev for a query. Returns up to 8 organic results as {title,url,snippet}.",
  parameters: z.object({ query: z.string() }),
  handler: async ({ query }): Promise<WebSearchResult[]> => {
    let apiKey: string;
    try {
      apiKey = requireEnv("SERPER_API_KEY");
    } catch (err) {
      throw new WebSearchError("missing SERPER_API_KEY", { cause: err });
    }

    let res: Response;
    try {
      res = await fetch(SERPER_SEARCH_URL, {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query }),
      });
    } catch (err) {
      throw new WebSearchError(
        `network error calling Serper: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new WebSearchError(
        `Serper request failed with status ${res.status}: ${body}`
      );
    }

    let json: SerperResponse;
    try {
      json = (await res.json()) as SerperResponse;
    } catch (err) {
      throw new WebSearchError("failed to parse Serper response as JSON", {
        cause: err,
      });
    }

    const organic = Array.isArray(json.organic) ? json.organic : [];
    return organic.slice(0, MAX_RESULTS).map((item) => ({
      title: item.title ?? "",
      url: item.link ?? "",
      snippet: item.snippet ?? "",
    }));
  },
});
