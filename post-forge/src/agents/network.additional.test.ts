/**
 * Complementary router-determinism tests (T18), on top of T04's own
 * `network.router.test.ts` (which already covers all 7 BRD partial states +
 * 2 empty-array edge cases -- read first, not duplicated here).
 *
 * Gaps this file closes:
 *  - `routeNext` never looks past the *first* unmet precondition in the
 *    if-ladder, so a state that has an early field missing but later
 *    fields already set (e.g. a stale/partial write) is still routed to
 *    the earliest unmet stage, not confused by the later fields.
 *  - `published` alone (without `posterImageId`) does not short-circuit
 *    to "done" -- the ladder still requires posterImageId first.
 *  - `routeNext` is a pure function of `state`: calling it twice with the
 *    same input yields the same output (no hidden mutation/order
 *    dependence), which the durable-step design in
 *    `src/inngest/functions.ts` relies on (the router closure is invoked
 *    once per network turn and must be safe to call repeatedly).
 */

import { describe, expect, it } from "vitest";
import type { Agent } from "@inngest/agent-kit";
import { routeNext, type PipelineAgents } from "./network";
import type { NetworkState } from "@/lib/state";

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
const finding = { claim: "c", source: { title: "t", url: "u" }, verified: false };
const verifiedFinding = { ...finding, verified: true };

describe("routeNext -- additional determinism coverage", () => {
  it("ignores later-stage fields when an earlier stage is unmet (research missing wins)", () => {
    // Contrived/corrupt state: draft/finalPost/posterImageId/published are
    // all set, but `research` itself is empty -- the ladder must still
    // send this back to research, not skip ahead because later fields
    // happen to be populated.
    const state: NetworkState = {
      ...baseState,
      research: [],
      verifiedFindings: [verifiedFinding],
      draft: "draft text",
      finalPost: "final text",
      posterImageId: "poster-1",
      published: true,
    };
    expect(routeNext(state, agents)).toBe(agents.research);
  });

  it("does not treat published:true as done when posterImageId is still missing", () => {
    const state: NetworkState = {
      ...baseState,
      research: [finding],
      verifiedFindings: [verifiedFinding],
      draft: "draft text",
      finalPost: "final text",
      // posterImageId intentionally unset
      published: true,
    };
    expect(routeNext(state, agents)).toBe(agents.illustrator);
  });

  it("is pure: repeated calls with an identical state return the identical result", () => {
    const state: NetworkState = {
      ...baseState,
      research: [finding],
      verifiedFindings: [verifiedFinding],
      draft: "draft text",
    };
    const first = routeNext(state, agents);
    const second = routeNext(state, agents);
    const third = routeNext({ ...state }, agents);
    expect(first).toBe(agents.editor);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("an empty finalPost string is treated as not-yet-edited (falsy check, not presence check)", () => {
    const state: NetworkState = {
      ...baseState,
      research: [finding],
      verifiedFindings: [verifiedFinding],
      draft: "draft text",
      finalPost: "",
    };
    expect(routeNext(state, agents)).toBe(agents.editor);
  });
});
