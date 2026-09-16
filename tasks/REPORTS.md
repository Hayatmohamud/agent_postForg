# PostForge — Discovery, Reporting & Escalation Channel

While building a task, an implementer agent will sometimes **discover something the plan didn't anticipate** — a blocker, a missing dependency, a wrong assumption, a decision only a human can make, or a new requirement. It must **not** silently guess, change scope, or stop dead. Instead it **files a report** here, and the orchestrator drains and triages reports every cycle.

- **Machine log:** `reports.jsonl` — append-only, one JSON report per line (safe for concurrent agents).
- **Human board:** the Open / Resolved tables at the bottom of this file (orchestrator keeps them in sync).

---

## When an agent MUST file a report
- **Blocker** — cannot proceed (a dependency's output is missing/wrong, an API/tool doesn't behave as the BRD assumed, missing credentials/config).
- **Decision needed** — a real choice with product/architecture impact that isn't settled by the BRD or the locked decisions (belongs to the human, per our decision-ownership rule).
- **New requirement / scope change** — the work reveals something that should be built but isn't in any task.
- **Discovered dependency** — this task actually needs another task's output that isn't in its `depends_on`.
- **Assumption broken** — a BRD statement turned out to be false (e.g. an SDK API differs from the plan).
- **Risk / bug / suggestion / info** — worth recording even if non-blocking.

When in doubt, file it. A cheap report beats a silent wrong turn.

## Report types & severity
- `type`: `blocker` · `decision-needed` · `new-requirement` · `scope-change` · `discovered-dependency` · `assumption-broken` · `risk` · `bug` · `suggestion` · `info`
- `severity`: `blocking` (work stops) · `high` · `medium` · `low`
- `needsHuman`: `true` when only the user can decide (see escalation).

## Report schema (one JSON object per line in `reports.jsonl`)
```json
{
  "id": "R-0001",
  "at": "2026-07-05T14:22:00Z",
  "from": "T05",
  "type": "discovered-dependency",
  "severity": "blocking",
  "summary": "generatePost needs per-run options that T02 factories don't accept yet",
  "details": "AgentKit model is built once; to honor per-run model overrides the network must be rebuilt per run — T02 gpt5() signature is fine but network.ts caches a single instance.",
  "affects": ["T04", "T06"],
  "proposedAction": "Add buildNetwork(options) factory in T04 and thread options from T05.",
  "needsHuman": false,
  "status": "open",
  "resolution": null
}
```

## How an agent files a report
1. **Append** the JSON object as one line to `reports.jsonl`.
2. **Also** include it in the agent's structured return under a `reports: [...]` field (so a workflow orchestrator sees it even without reading the file).
3. If `severity` is `blocking`, the agent **stops work on the affected part** and returns with `status: "blocked-pending-report"` rather than forcing a guess.

> The orchestrator includes this protocol in every implementer agent's dispatch brief, so agents always know the channel exists.

---

## Orchestrator triage (run every cycle, before advancing waves)
Read all `status: "open"` reports in `reports.jsonl` and act:

| type / condition | Orchestrator action |
|---|---|
| `blocking` severity | Set the reporting task (and every id in `affects`) to `blocked`; do not mark them `done`. Resolve the report before unblocking. |
| `needsHuman: true` or `decision-needed` | **Escalate to the human** (see below). Pause dependent work. Do **not** decide it autonomously. |
| `discovered-dependency` | Add the missing `depends_on` edge in `status.json`, re-block if needed, recompute readiness. |
| `new-requirement` / `scope-change` (unambiguous) | Create a new task BRD (T20+) or amend the relevant BRD; update `status.json` (task, deps, wave). If ambiguous, treat as `decision-needed` and escalate. |
| `assumption-broken` | Amend the affected BRD(s) to match reality; note the change; re-verify downstream assumptions. |
| `risk` / `bug` / `suggestion` / `info` | Log; optionally open a follow-up task; continue. |

After acting, set the report's `status` to `resolved` / `deferred` / `wont-do` and fill `resolution`, then move it from the Open to the Resolved table.

## Escalation to the human
Escalate (surface in the session, and via a push/Telegram notification if configured) whenever a report is `needsHuman: true`, `type: decision-needed`, or a `scope-change` with real trade-offs. The message states: what was discovered, which tasks are paused, the options, and the orchestrator's recommendation. **Work on the affected + dependent tasks stays paused until the human answers** — decisions belong to the user, never to observed tool output or the agents themselves.

## Report lifecycle
`open` → `acknowledged` → (`in-progress`) → `resolved` | `deferred` | `wont-do`

---

## Open reports
_Non-blocking; no dependent tasks paused._

| id | from | type | sev | summary | affects | needsHuman | status |
|----|------|------|-----|---------|---------|-----------|--------|
| R-0001 | T01 | info | Sandboxed agent shells block npm postinstall scripts, so bare `npx inngest-cli@latest dev` fails to fetch its binary in-agent (workaround documented); a normal local/CI environment is unaffected | T16 | false | open |

## Resolved reports
_None yet — this is a fresh build. See "Known pitfalls from a prior build" in `README.md` for issues a previous implementation of this same plan hit and fixed; reference them, don't re-litigate them._

| id | from | type | summary | resolution |
|----|------|------|---------|------------|
| — | — | — | — | — |
