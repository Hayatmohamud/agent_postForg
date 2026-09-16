@AGENTS.md

# PostForge — Project Contract & Conventions

PostForge is a greenfield **autonomous multi-agent content generator**: a user submits a topic → an
AgentKit network (**Research → Verify → Write → Edit → Illustrate → Publish**) runs inside an **Inngest**
durable function → the finished post + poster persist to **MongoDB**, and the UI shows live progress by
polling. Full architecture: `PLAN.md`. Design brief: `DESIGN_PROMPT.md`.

## ⚠️ Next.js — breaking changes vs your training data
**Versions installed by T01 (record for downstream tasks):** Next.js `16.3.5`, React `19.2.8`, Tailwind CSS `^4` (via `@tailwindcss/postcss`), ESLint `^9` with `eslint-config-next@16.3.5` (flat config — `eslint.config.mjs`, not `.eslintrc`), TypeScript `^5`, Node `24.19.0` (built/verified against; `@types/node` pinned to `^22` because `vitest@5` requires `@types/node` `^22 || >=24`), Inngest `4.20.0`, `@inngest/agent-kit` `0.13.2`, `mongodb` `7.6.0`, `zod` `4.6.5`, `@google/genai` `2.22.0`, `openai` `7.15.0`, `vitest` `5.0.1`.

Recent Next.js majors change APIs/conventions frequently (async request APIs — dynamic route `params`/`searchParams` are `Promise`s and must be `await`ed even in Route Handlers; `next lint` removed in favor of flat-config `eslint`; Turbopack is the `next dev` default in v16, but `npm run build` in this repo explicitly passes `--webpack` — see the worktree pitfall below). **Before writing any Next.js / React / Tailwind code, read the relevant guide in `node_modules/next/dist/docs/`** and confirm against live docs (Context7 MCP or web search) — never rely on training-data memory. The imported `AGENTS.md` carries the same advisory.

**Worktree build note:** `post-forge/package.json`'s `build` script runs `next build --webpack`, not the Turbopack default, because Turbopack builds can fail inside a git worktree when `node_modules` resolves outside the worktree root (see `tasks/README.md`'s known pitfalls). `next dev` still uses Turbopack (unaffected in testing here). Re-verify a plain Turbopack `next build` after merging to `main`, where `node_modules` is no longer worktree-relative.

**Inngest local dev note:** Inngest v4 defaults to cloud mode, so `post-forge/package.json`'s `dev` script sets `INNGEST_DEV=1` (via `cross-env` for Windows/POSIX portability) — without it `/api/inngest` 500s when `npx inngest-cli@latest dev` tries to sync locally. Verified in T01: with `INNGEST_DEV=1` set, `GET /api/inngest` reports `{"mode":"dev","function_count":0,...}` and the Inngest dev server (`inngest-cli@1.44.0`) syncs the `post-forge` app with zero functions registered, as expected until T05.

## How this project is built (orchestration)
- The build is driven by the **Orchestrator** model in `ORCHESTRATOR.md`. Tasks **T01–T19** each have a BRD in `tasks/`.
- **`tasks/status.json` is the single source of truth** for task state — read it at the top of every cycle; never act from memory. Keep it and the status table in `tasks/README.md` in sync on **every** state change.
- Tasks run in **waves**; a task is `ready` only when every id in its `dependsOn` is `done`. Same-wave tasks run in isolated **git worktrees** branched off `main`, merged back after verification.
- Implementers never guess on a blocker / decision / broken-assumption / missing-dependency — they file a report in `tasks/reports.jsonl` (protocol: `tasks/REPORTS.md`); the orchestrator triages and escalates human decisions.
- **Verification is mandatory before `done`:** `command` tasks run build / typecheck / test / DB checks; `screen` (UI) tasks are screenshotted at **desktop + mobile** via Claude-in-Chrome and compared against the design system (T07) + the task's acceptance criteria.
- `tasks/README.md`'s "Known pitfalls from a prior build" section documents real bugs a previous implementation of this exact plan hit and fixed — read it before dispatching T02–T19 and bake the relevant ones into each brief.

## Locked decisions (apply everywhere)
- **Auth:** cosmetic stub, single-tenant — no sessions, no `userId` — for v1, per `PLAN.md`. Real auth is a separate hardening pass (`SECURITY_CHECKLIST.md`) done only after T16.
- **API keys:** env-only. Settings shows integration status + test-connection; **never** key entry.
- **Live progress:** poll `GET /api/posts/[id]` + persisted per-stage sub-progress (reveal-on-update; no token streaming).
- **Doc ownership:** `POST /api/generate` creates the post doc + mints `runId`; the Inngest function only *updates* it.
- **Design system:** implemented **directly in code** in T07 (Tailwind tokens + `src/components/ui`) from `DESIGN_PROMPT.md` — no external design tool/MCP is available on this account, so there is no separate mockup-import step. Managed centrally in T07; no other task redefines tokens.

## Env contract (`.env`, mirrored by `.env.example`)
Read through `src/lib/env.ts` (`requireEnv` throws a named error when a required var is missing):
- `OPENROUTER_API_KEY`, `LLM_MODEL=openai/gpt-5.5` — text generation for every agent, via OpenRouter.
- `SERPER_API_KEY` — web search.
- `GEMINI_API_KEY` (default poster provider, `gemini-3.1-flash-image`) and/or `OPENAI_API_KEY` + `IMAGE_PROVIDER=openai` (alt poster provider, GPT Image) — per `PLAN.md`'s provider abstraction (`lib/image.ts`).
- `MONGODB_URI` — persistence + GridFS poster bytes (local dev: `mongodb://127.0.0.1:27017/postforge`).
- `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` — only required for non-local Inngest.
- If a subagent discovers a reason to change this contract (e.g. funneling images through OpenRouter too), that's an `assumption-broken`/`suggestion` report, not a silent change — the orchestrator decides.

## Stack — verify against live docs before use (never training-data memory)
Next.js (App Router, TS) · React · Tailwind · Inngest + Inngest AgentKit · OpenRouter · Serper.dev · GridFS/MongoDB · Vitest.
**Rule:** before using any external library / SDK / API, confirm current syntax, versions, and behavior via the **Context7 MCP** or web search. This applies to every task and every subagent.

## Scripts & local run
`npm run dev` · `build` · `start` · `lint` (`eslint`) · `typecheck` (`tsc --noEmit`) · `test` (vitest) · `seed` (`tsx scripts/seed.ts`).
Local end-to-end: `npm run dev` **+** `npx inngest-cli@latest dev` (Inngest dashboard).
