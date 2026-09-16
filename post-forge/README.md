# PostForge

Autonomous multi-agent content generator (Next.js App Router + Inngest + AgentKit + MongoDB). Full
architecture: `../PLAN.md`. Project conventions: `../CLAUDE.md`.

## Prerequisites
- Node.js 20+ (built/verified against Node 24)
- A local MongoDB instance (default: `mongodb://127.0.0.1:27017/postforge`)
- Provider API keys as needed: OpenRouter (`OPENROUTER_API_KEY`), Serper.dev (`SERPER_API_KEY`),
  Gemini and/or OpenAI (`GEMINI_API_KEY` / `OPENAI_API_KEY`)

## Dev setup
```bash
cp .env.example .env      # fill in the keys you have; unset optional vars are fine at boot
npm install
npm run dev                # starts Next.js with INNGEST_DEV=1 (local Inngest mode)
npx inngest-cli@latest dev # in a second terminal — connects to /api/inngest
```

Then open http://localhost:3000 for the app and the URL the Inngest CLI prints (typically
http://localhost:8288) for the Inngest dev dashboard. With no functions registered yet, the
dashboard will correctly show zero functions — that's expected until T05 lands.

## Scripts
- `npm run dev` — Next.js dev server (local Inngest mode)
- `npm run build` — production build (uses the Webpack build; see note below)
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config)
- `npm run typecheck` — `tsc --noEmit`
- `npm run test` — Vitest
- `npm run seed` — populates demo data: a handful of `Post` docs spanning
  `done`/`failed`/in-progress statuses (with realistic stages, subProgress,
  sources, and telemetry so dashboard charts have something to render),
  matching placeholder poster images in the `posters` GridFS bucket (locally
  generated solid-color PNGs — no paid image API calls), and two sample
  `schedules` documents (one enabled, one disabled). Idempotent: every
  seeded document uses a fixed id, so running it again replaces the same
  records instead of duplicating them. Requires `MONGODB_URI` to be
  reachable (see `.env.example`).

## Notes
- **Env contract**: see `src/lib/env.ts` (`env()` / `requireEnv()`) and `.env.example` for the full
  list of nine vars. Only `.env.example` is committed — `.env` is gitignored.
- **Inngest local mode**: Inngest v4 defaults to cloud mode, which makes `/api/inngest` 500 on a
  local sync. The `dev` script sets `INNGEST_DEV=1` so `npx inngest-cli@latest dev` connects cleanly.
- **Build in a git worktree**: `npm run build` passes `--webpack` because Turbopack builds can fail
  inside a git worktree when `node_modules` is resolved outside the worktree root. Re-verify a plain
  Turbopack `next build` after merging to `main`.
