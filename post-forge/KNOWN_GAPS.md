# Known gaps / requires live credentials

This file tracks exactly what has **not** been live-verified across PostForge's entire build,
and why — so a future reader (human or agent) can pick up the live end-to-end (E2E) verification
without re-discovering the same gap from scratch. It complements the
[verification checklist](README.md#verification-checklist) in the README, which lists every
BRD-required check as an unchecked TODO.

## The root cause: no live credentials in any task-implementer's environment

Every task-implementer worktree across this entire 19-task build (T01 through T19) has lacked
all three of:
- `OPENROUTER_API_KEY` (every text and image model call)
- `SERPER_API_KEY` (the `web_search` tool)
- a reachable `MONGODB_URI` (no local MongoDB instance running in-sandbox)

This is the single root cause behind every report below. Nothing in the codebase is blocked on
missing functionality — it's blocked on missing external services in the environments these
tasks were built in. This T16 dispatch (documentation + static verification) hit the exact same
gap and did not attempt to fake or mock around it.

## The report chain (`tasks/reports.jsonl`)

| Report | From task | What it found |
|---|---|---|
| R-0001 | T01 | `npx inngest-cli@latest dev` fails in a sandboxed shell because npm postinstall scripts (which fetch the CLI's platform binary) are blocked by default. Worked around by explicitly approving/rebuilding `inngest-cli` and running the local binary directly — confirmed the app's `/api/inngest` wiring itself needs zero credentials to sync locally. Re-confirmed in this T16 dispatch via `GET /api/inngest` directly (`function_count: 2`, no live server needed at all to prove registration). A normal, non-sandboxed developer does not hit this. |
| R-0002 | T02 | No local MongoDB reachable to live-verify `mongo.ts`/`posts-repo.ts`/`settings-repo.ts` round-trips. |
| R-0003 | T02 | No `OPENROUTER_API_KEY` to live-verify `models.ts`/`image.ts` against real OpenRouter calls. |
| R-0004 | T02 | OpenRouter's documented image-generation shape was ambiguous between a dedicated `/api/v1/images` endpoint and a chat-completions `modalities` shape; `src/lib/image.ts` implements both defensively (tries `/images` first, falls back to chat-completions) since it could not be confirmed live. **Still needs a live key to confirm which path `google/gemini-3.1-flash-image` actually uses**, and to delete the unused path. |
| R-0007 | T03 | No `SERPER_API_KEY`/`OPENROUTER_API_KEY`/MongoDB to live-verify `web_search`/`generate_poster`/`save_post` end-to-end (SSRF guard and error paths were verified without live keys). |
| R-0009 | T05 | No credentials to live-verify `buildNetwork(options).run(topic)` end-to-end. |
| R-0010 | T05 | No credentials to live-verify `generatePost` (the Inngest durable function) end-to-end — same root cause as R-0009. |
| R-0011 | T05 | **Needed a human decision, since resolved** (see `tasks/status.json`'s T05 note and `T16-verification.md`): T04's agents gracefully degrade every tool/model error into a lower-quality-but-`done` post rather than propagating a real failure, so a bad `SERPER_API_KEY` does **not** produce `status:"failed"` as the original BRD assumed. Resolution: this is the intended UX (graceful degradation beats a hard failure for a flaky search key); the real `status:"failed"` failure path should instead be demonstrated with a genuinely fatal fault, e.g. an unreachable `MONGODB_URI`. The README's verification checklist reflects this resolution. |
| R-0012 | T06 | No reachable MongoDB (and no `OPENROUTER_API_KEY`/`SERPER_API_KEY`) to live-verify the API surface against real data; verified against `.env`-absent/mocked paths only. |
| R-0013 | T12 | No reachable MongoDB to live-verify `PostView` against a real seeded `done` post; verified against mocked `PostDetail` fixtures instead. |

## What this means concretely has NOT been verified

- **The full six-stage pipeline run** (research → verify → write → edit → illustrate →
  publish) has never executed against real Serper/OpenRouter/Mongo in this project's
  development. Individual stages have been code-reviewed, unit-tested against mocks, and (per
  R-0001) confirmed to register and wire up correctly with Inngest — but never run live,
  start to finish, for a real topic.
- **Real poster generation** — whether OpenRouter's `/api/v1/images` endpoint or the
  chat-completions `modalities` fallback actually fires for `google/gemini-3.1-flash-image` — is
  unconfirmed (R-0004).
- **The failure/recovery path** — an unreachable `MONGODB_URI` triggering Inngest retries, a
  `status:"failed"` doc, the UI surfacing the error, and a clean recovery once Mongo is
  restored — has not been executed (needs a real, then briefly broken, Mongo instance).
- **Dedupe/rate-limit (T19) against real concurrent runs** — the guard's logic
  (`src/app/api/generate/core.ts`, `src/lib/generation-guards.ts`) is unit-tested, but rapid
  real submissions against a live, running pipeline have not been exercised.
- **Cron firing a real post** — `src/inngest/cron.ts`'s schedule wiring is code-complete and
  covered by tests/seed fixtures (T17 seeded sample `schedules` docs), but an actual scheduled
  run producing a real post via a live Inngest cron trigger has not been observed.
- **Every "screen verification" screenshot the BRD's §8 calls for** (landing, new-post, live
  pipeline, post detail, dashboard, library, scheduled, settings, captured during a live E2E
  run as evidence) — none were captured, since capturing them meaningfully requires the live
  pipeline actually producing real data to display, not a static/seeded snapshot.
- **The "memory" behavior** (a second topic appearing in the library, the router
  reusing/querying prior Mongo context) — plausible from code review and seed-data rendering,
  but not observed from two consecutive live pipeline runs.

## What HAS been verified (this T16 dispatch, no live credentials needed)

- `npm run build` (webpack) — passes; two harmless webpack warnings from Inngest's optional
  OpenTelemetry auto-instrumentation deps, unrelated to PostForge code.
- `npm run typecheck` — passes, zero errors.
- `npm run test` — 63/63 tests passing across 9 test files (unit + integration tests against
  mocks — see `src/**/*.test.ts`).
- Inngest function discovery: `GET /api/inngest` reports `function_count: 2`
  (`generatePost` + the cron function), `has_event_key: false`, `has_signing_key: false`,
  `mode: "dev"` — confirming both durable functions register correctly with zero live
  credentials, corroborating R-0001's finding that the app's own Inngest wiring needs none.
- Every route in the product surface builds and is statically reachable (`npm run build`'s
  route table: `/`, `/new-post`, `/posts/[id]`, `/dashboard`, `/gallery`, `/library`,
  `/scheduled`, `/settings`, `/sign-in`, `/sign-up`, plus every `/api/*` route) — this confirms
  the screens exist and compile, not that they render correctly against live data.
- `.env.example` and `README.md` cross-checked against `src/lib/env.ts`'s `EnvVarName` union and
  a full-tree grep of `process.env.`/`requireEnv(`/`env(` usage — no stale or missing vars.

## Explicitly out of scope (per PLAN.md and the T16 BRD's own §10 / risk notes)

- **Production/deployment verification** — the `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY`
  cloud-sync path is deferred for v1 by design (`PLAN.md`'s "Design decisions": no live social
  publishing, MongoDB persistence only). Not attempted here.

## Recommended next step

Once a real `OPENROUTER_API_KEY`, `SERPER_API_KEY`, and a reachable `MONGODB_URI` are available
(local MongoDB is easiest — see the README's Prerequisites), a human or a future dispatch should
work through the [verification checklist](README.md#verification-checklist) in order, checking
off each item as it passes, and update this file with the outcome of R-0004's still-open
"which image endpoint does `google/gemini-3.1-flash-image` actually use" question.
