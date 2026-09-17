# PostForge

Autonomous multi-agent content generator: a user submits a topic, and an orchestrated network
of AI agents — research → verify → write → edit → illustrate → publish — turns it into a
finished, sourced post with a generated poster image, with zero human gate in between.

Built with **Next.js (App Router, TS)** + **Inngest** (durable orchestration, retries, cron) +
**Inngest AgentKit** (the agent network + deterministic router) + **OpenRouter** (every model
call, text and image) + **Serper.dev** (web search) + **MongoDB** (persistence + GridFS for
poster bytes + the "memory" of past posts).

Full architecture: `../PLAN.md`. Design brief: `../DESIGN_PROMPT.md`. Project conventions:
`../CLAUDE.md`. Task-by-task build history: `../tasks/` (BRDs, `status.json`,
`tasks/reports.jsonl` for discoveries/gaps surfaced along the way).

---

## Architecture overview

```
Browser (Next.js UI)
  │  submit topic
  ▼
POST /api/generate  ──emits event──►  Inngest ("post/generate.requested")
                                          │
                                          ▼
                            Inngest durable function (generatePost)
                                          │  runs
                                          ▼
                          ┌── AgentKit Network ──────────────────┐
                          │  Router (deterministic, state-       │
                          │  driven state machine)               │
                          │    Research → Verify → Write         │
                          │      → Edit → Illustrate → Publish   │
                          └───────────────────────────────────────┘
                                          │  each stage writes network.state.data
                                          │  and is persisted to Mongo as it completes
                                          ▼
                                     MongoDB (posts collection)
  Browser polls GET /api/posts/[id] for live per-stage progress + the final result
```

- **Router** (`src/agents/network.ts`) is deterministic code, not a model call: it inspects
  `network.state.data` and picks the next agent, stopping once `published === true`.
- **"Memory"** = network state during a single run, plus the MongoDB `posts` history queried
  before/around a run (surfaced in the UI's library/dashboard, and used by the dedupe guard).
- Running the network inside an Inngest function makes every model/tool call a durable,
  retryable step, visible live in the Inngest dev dashboard.
- Poster bytes are generated via OpenRouter (`src/lib/image.ts`) and stored in **GridFS**,
  served back through `GET /api/posters/[id]`.
- A **cron-triggered Inngest function** (`src/inngest/cron.ts`) can fire the same pipeline on a
  schedule, managed from the Settings/Scheduled screens (T14).
- A **rate-limit + dedupe guard** (`src/app/api/generate/core.ts`, T19) refuses a new run when
  too many generations are already in flight, or when the same normalized topic was already run
  recently.

See `../PLAN.md` for the full data model, per-agent tool list, and file layout.

---

## Prerequisites

- Node.js 20+ (built/verified against Node 24)
- A local MongoDB instance (default connection string:
  `mongodb://127.0.0.1:27017/postforge`) — required for anything that persists a post,
  including `npm run seed`
- Provider API keys, once you want to exercise the live pipeline (all optional for just
  building/typechecking/testing):
  - **OpenRouter** (`OPENROUTER_API_KEY`) — the single credential for every AI call in the
    system: every agent's text generation *and* poster image generation both go through
    OpenRouter. There are no separate Gemini/OpenAI provider keys.
  - **Serper.dev** (`SERPER_API_KEY`) — the `web_search` tool used by the Research/Verify
    agents.

## Env / secret setup

```bash
cp .env.example .env      # fill in the keys you have; every var has a sane default or is
                           # read lazily, so the app boots fine with unset optional vars
```

`.env` is gitignored; only `.env.example` is committed. `src/lib/env.ts` is the single typed
source of truth for every variable PostForge reads (`env()` for optional vars — never throws;
`requireEnv()` for vars a code path genuinely can't run without — throws a named
`MissingEnvError` only when that path is actually exercised, never at import/boot time).

| Variable | Required? | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | Required for any real AI call (text or image). Legacy alias `OPEN_ROUTER` also accepted. | The one credential for every OpenRouter call in the app. |
| `LLM_MODEL_SMART` | Optional (defaults to `openai/gpt-5.5`) | Model id for orchestration/quality agents (editor, verify). |
| `LLM_MODEL_CHEAP` | Optional (defaults to `google/gemini-2.5-flash-lite`) | Model id for cheaper/lighter agents (writer). |
| `LLM_MODEL` | Optional (defaults to `LLM_MODEL_SMART`) | General fallback text model id. |
| `IMAGE_MODEL` | Optional (defaults to `google/gemini-3.1-flash-image`, i.e. "Nano Banana") | Poster image generation model id, also via OpenRouter. Swap to e.g. `openai/gpt-image-2` to use GPT Image 2 instead — no separate provider key or code change needed, since both go through the one OpenRouter credential. |
| `SERPER_API_KEY` | Required for the `web_search` tool (Research/Verify agents) to return real results. | Serper.dev web search credential. |
| `MONGODB_URI` | Required for anything that persists (defaults to `mongodb://127.0.0.1:27017/postforge`). | Mongo connection string; also backs GridFS (posters) and the settings store. |
| `INNGEST_EVENT_KEY` | Optional — only for non-local/cloud Inngest sync. | Inngest Cloud event key. |
| `INNGEST_SIGNING_KEY` | Optional — only for non-local/cloud Inngest sync. | Inngest Cloud signing key (verifies inbound webhook calls). |
| `MAX_INFLIGHT_RUNS` | Optional (defaults to `3`) | Max posts allowed in a non-terminal status at once before `POST /api/generate` refuses new runs. |
| `DEDUPE_WINDOW_HOURS` | Optional (defaults to `24`) | Lookback window (hours) for blocking a repeat run of the same normalized topic. |

All twelve names above are the complete `EnvVarName` union in `src/lib/env.ts`; `.env.example`
documents each with an inline comment and is kept in sync with this table.

## Running the dev stack

Two terminals, plus a reachable MongoDB:

```bash
npm install

# Terminal A — Next.js app (sets INNGEST_DEV=1 for local Inngest mode)
npm run dev

# Terminal B — Inngest dev server, connects to /api/inngest
npx inngest-cli@latest dev
```

Then open `http://localhost:3000` for the app, and the URL the Inngest CLI prints (typically
`http://localhost:8288`) for the Inngest dev dashboard. Once the app is running, the dashboard
should discover exactly two registered functions: `generatePost` (the six-stage pipeline,
triggered by `POST /api/generate`) and the cron function (`src/inngest/cron.ts`, scheduled
trending-topic auto-post).

**Local Inngest mode note:** Inngest v4 defaults to cloud mode, which makes `/api/inngest` 500
on a local sync. The `dev` script sets `INNGEST_DEV=1` so `npx inngest-cli@latest dev` connects
cleanly without `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY`.

**If `npx inngest-cli@latest dev` fails to fetch its binary** (e.g. `Error: Inngest CLI binary
not found`) in a sandboxed/CI-like shell that blocks npm postinstall scripts: add it as a
devDependency, explicitly approve and rebuild it, then run the local binary directly instead of
`npx`:
```bash
npm install -D inngest-cli
npm install-scripts approve inngest-cli   # or your package manager's equivalent allow-list step
npm rebuild inngest-cli
./node_modules/.bin/inngest dev -u http://localhost:3000/api/inngest
```
A normal (non-sandboxed) developer machine does not need this workaround.

## Seeding demo data

```bash
npm run seed
```

Populates demo data so the UI (dashboard charts, library, scheduled screen) has something to
render without needing a live pipeline run first: a handful of `Post` documents spanning
`done`/`failed`/in-progress statuses (with realistic stages, sub-progress, sources, and
telemetry), matching placeholder poster images in the `posters` GridFS bucket (locally
generated solid-color PNGs — no paid image API calls), and two sample `schedules` documents
(one enabled, one disabled). Idempotent: every seeded document uses a fixed id, so re-running
it replaces the same records rather than duplicating them. Requires `MONGODB_URI` to be
reachable.

## Scripts

- `npm run dev` — Next.js dev server (local Inngest mode)
- `npm run build` — production build (`next build --webpack`; see worktree note below)
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config)
- `npm run typecheck` — `tsc --noEmit`
- `npm run test` — Vitest
- `npm run seed` — see above

**Build-before-typecheck note:** `npm run typecheck` can fail standalone with
`Cannot find name 'LayoutProps'`. Next.js generates ambient route types (`.next/types`) as a
side effect of `npm run build`; run `build` before `typecheck` (or after touching new route
files) if typecheck reports a missing global type.

**Build in a git worktree:** `npm run build` passes `--webpack` because Turbopack builds can
fail inside a git worktree when `node_modules` resolves outside the worktree root. Re-verify a
plain Turbopack `next build` after merging to `main`.

---

## Verification checklist

This is the full end-to-end verification from the project's final task (T16). The items below
that need real provider credentials (`OPENROUTER_API_KEY`, `SERPER_API_KEY`, a reachable
`MONGODB_URI`) have **not** been executed yet in this build — see
["Known gaps / requires live credentials"](#known-gaps--requires-live-credentials) below for
exactly what's outstanding and why. Check items off here once you've run them against a real
stack:

- [ ] Fresh clone → `.env` filled from `.env.example` → `npm install` → `npm run dev` +
      `npx inngest-cli@latest dev` → app reachable at `localhost:3000`, Inngest dashboard shows
      `generatePost` and the cron function registered.
- [ ] Submit a topic (e.g. "World Cup 2026") in the UI; watch the pipeline advance live, both in
      the UI's stage timeline and as durable steps in the Inngest dashboard (research → verify →
      write → edit → illustrate → publish, in order).
- [ ] Expand the Inngest steps for that run and confirm real Serper results, real OpenRouter
      text outputs, and a real image-generation call.
- [ ] On completion, the finished post + poster image + clickable cited sources render at
      `/posts/[id]`.
- [ ] In MongoDB (Compass/`mongosh`), confirm one `posts` document with `status:"done"`,
      `finalPost`, `sources`, and `posterImageId` set; `GET /api/posters/<id>` returns the image
      bytes.
- [ ] **Failure path** (per R-0011's resolution — a bad `SERPER_API_KEY` degrades gracefully to
      a lower-quality `done` post by design, it does *not* fail the run): temporarily point
      `MONGODB_URI` at an unreachable host, trigger a run, confirm Inngest retries then the doc
      (or run) ends in `status:"failed"` with the error surfaced in the UI. Restore
      `MONGODB_URI` and confirm a fresh run recovers.
- [ ] **Memory:** submit a second, distinct topic; confirm it appears in the library/dashboard
      alongside the first.
- [ ] **Dedupe/rate-limit (T19):** rapidly resubmit the same topic (or exceed
      `MAX_INFLIGHT_RUNS` concurrent runs); confirm `POST /api/generate` refuses the repeat/
      excess request with a clear error rather than starting a duplicate pipeline.
- [ ] **Cron:** confirm a scheduled run (Settings/Scheduled screen, T14) fires on its configured
      schedule and produces a new post without manual submission.
- [ ] `npm run test` is green (63+ tests as of this build — see
      [Static verification results](#static-verification-results-run-in-this-worktree) below).
- [ ] Every screen of the product surface is reachable and functioning: landing, new-post,
      live pipeline (pipeline showcase), post detail, dashboard, library, scheduled, settings.
      Capture a screenshot of each as evidence during a live run.

### Static verification results (run in this worktree)

The items below do **not** need live provider credentials and were executed directly in this
worktree as part of documentation finalization (T16, 2026-09-17):

- `npm run build` (`next build --webpack`) — **passed.** Compiles with two harmless webpack
  warnings from Inngest's optional OpenTelemetry auto-instrumentation deps
  (`@opentelemetry/instrumentation-winston` module-not-found, and a "critical dependency"
  warning from `require-in-the-middle` inside `@traceloop/instrumentation-anthropic`) — both are
  Inngest's own optional tracing integrations, unrelated to PostForge code, and do not affect
  the build output or runtime. All 22 routes compiled (13 dynamic API/page routes, 9 static).
- `npm run typecheck` (`tsc --noEmit`, run **after** `build` per the documented
  `LayoutProps` pitfall) — **passed, zero errors.**
- `npm run test` (`vitest --run`) — **passed: 9 test files, 63 tests, all green** — matches the
  63-test count called out in this task's brief exactly.
- Inngest function discovery: started `npm run dev` (`INNGEST_DEV=1`) and queried
  `GET /api/inngest` directly (the same introspection endpoint the Inngest dev server itself
  polls) — response: `{"has_event_key":false,"has_signing_key":false,"function_count":2,"mode":"dev",...}`.
  `function_count: 2` confirms both `generatePost` and the cron function (`src/inngest/cron.ts`)
  are registered and discoverable with **zero** live credentials (`has_event_key`/
  `has_signing_key` both `false`, `mode: "dev"`), consistent with R-0001's finding (see
  `../tasks/reports.jsonl`) that a bare `npx inngest-cli@latest dev` only fails in this
  environment because a sandboxed shell blocks `inngest-cli`'s postinstall binary fetch — the
  app's own Inngest wiring needs no credentials at all for local dev discovery.

---

## Known gaps / requires live credentials

See `KNOWN_GAPS.md` for the full list of what has not been live-verified in this project so
far, and why — including a trace back through `../tasks/reports.jsonl`'s R-0002 through R-0013.
In short: **no `OPENROUTER_API_KEY`, `SERPER_API_KEY`, or reachable `MONGODB_URI` has existed in
any task-implementer's environment for this entire build**, so nothing that requires an actual
network round-trip to those three systems has been exercised end-to-end. Everything that could
be verified without them (typecheck, build, unit/integration tests against mocks, static route
discovery, Inngest function registration) has been.

Production/deployment verification (the `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` cloud-sync
path) is explicitly out of scope for v1 per `../PLAN.md` and the T16 BRD's own risk notes — it
is not attempted here.
