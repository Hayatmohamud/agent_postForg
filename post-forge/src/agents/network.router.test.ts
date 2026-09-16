/**
 * Router determinism tests (T04 BRD §8.1 / acceptance criteria).
 *
 * Pure-logic tests against `routeNext`: no model, no network run, no
 * external services (OpenRouter/Serper/Mongo) required — this is the
 * verification path available in this environment (see tasks/reports.jsonl
 * for the credentials blocker filed alongside this task).
 */

import { describe, expect, it } from "vitest";
import type { Agent } from "@inngest/agent-kit";
import { routeNext, type PipelineAgents } from "./network";
import type { NetworkState } from "@/lib/state";

// Stand-in agents: routeNext only ever compares/returns these by reference,
// it never inspects agent internals, so plain named stubs are sufficient
// and avoid needing a real model (OPENROUTER_API_KEY) to construct one.
function stubAgent(name: string): Agent<NetworkState> {
  return { name } as unknown as Agent<NetworkState>;
}

const agents: PipelineAgents = {
  research: stubAgent("research"),
  verify: stubAgent("verify"),
  writer: stubAgent("writer"),
  editor: stubAgent("editor"),
  illustrator: stubAgent("illustrator"),
  publisher: stubAgent("publisher"),
};

const baseState = { runId: "run-1", options: {} };

describe("routeNext (deterministic code router)", () => {
  it("empty state -> research", () => {
    const state: NetworkState = { ...baseState };
    expect(routeNext(state, agents)).toBe(agents.research);
  });

  it("research-only -> verify", () => {
    const state: NetworkState = {
      ...baseState,
      research: [{ claim: "c", source: { title: "t", url: "u" }, verified: false }],
    };
    expect(routeNext(state, agents)).toBe(agents.verify);
  });

  it("+verifiedFindings -> writer", () => {
    const state: NetworkState = {
      ...baseState,
      research: [{ claim: "c", source: { title: "t", url: "u" }, verified: false }],
      verifiedFindings: [{ claim: "c", source: { title: "t", url: "u" }, verified: true }],
    };
    expect(routeNext(state, agents)).toBe(agents.writer);
  });

  it("+draft -> editor", () => {
    const state: NetworkState = {
      ...baseState,
      research: [{ claim: "c", source: { title: "t", url: "u" }, verified: false }],
      verifiedFindings: [{ claim: "c", source: { title: "t", url: "u" }, verified: true }],
      draft: "draft text",
    };
    expect(routeNext(state, agents)).toBe(agents.editor);
  });

  it("+finalPost -> illustrator", () => {
    const state: NetworkState = {
      ...baseState,
      research: [{ claim: "c", source: { title: "t", url: "u" }, verified: false }],
      verifiedFindings: [{ claim: "c", source: { title: "t", url: "u" }, verified: true }],
      draft: "draft text",
      finalPost: "final text",
      title: "Title",
    };
    expect(routeNext(state, agents)).toBe(agents.illustrator);
  });

  it("+posterImageId -> publisher", () => {
    const state: NetworkState = {
      ...baseState,
      research: [{ claim: "c", source: { title: "t", url: "u" }, verified: false }],
      verifiedFindings: [{ claim: "c", source: { title: "t", url: "u" }, verified: true }],
      draft: "draft text",
      finalPost: "final text",
      title: "Title",
      posterImageId: "poster-1",
    };
    expect(routeNext(state, agents)).toBe(agents.publisher);
  });

  it("+published -> undefined (done)", () => {
    const state: NetworkState = {
      ...baseState,
      research: [{ claim: "c", source: { title: "t", url: "u" }, verified: false }],
      verifiedFindings: [{ claim: "c", source: { title: "t", url: "u" }, verified: true }],
      draft: "draft text",
      finalPost: "final text",
      title: "Title",
      posterImageId: "poster-1",
      published: true,
      postId: "post-1",
    };
    expect(routeNext(state, agents)).toBeUndefined();
  });

  it("treats an empty research array the same as unset (still -> research)", () => {
    const state: NetworkState = { ...baseState, research: [] };
    expect(routeNext(state, agents)).toBe(agents.research);
  });

  it("treats an empty verifiedFindings array the same as unset (still -> verify)", () => {
    const state: NetworkState = {
      ...baseState,
      research: [{ claim: "c", source: { title: "t", url: "u" }, verified: false }],
      verifiedFindings: [],
    };
    expect(routeNext(state, agents)).toBe(agents.verify);
  });
});
