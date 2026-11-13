# Project context

What this project is, how to run it, and what has been decided. Agents read this at intake. The log runs newest last.

## What this is

Bible Journey is a mobile-first web app that takes one reader through the whole Bible in a year, in chronological order: 52 weeks, 312 reading days, 1,189 chapters, with a weekly deep dive, a memory verse, a timeline of eras and a who's-who reference. The first reader is an adult newcomer on a phone who needs "what am I reading today, and what's the context?" answered in one glance. The current day is the first unread day, never a calendar date, and missed days are never framed as failure. Done means the daily loop works on a phone, signed out and signed in, and the checks in CI pass.

## Stack and commands

- Default branch: `main`. MVP work stacks on `feature/mvp`; each milestone is a `gw/BJ-<n>` branch with a PR into `feature/mvp`.
- Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Zod, Vitest. Playwright arrives with BJ-1.
- Run: `npm run dev`
- Test: `npm run test`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Build: `npm run build`

## Read first

- `README.md`
- `docs/reference/build-brief.md`: the product brief. Features, data model, design direction, milestones.
- `docs/reference/prototype.html`: the working single-file prototype. Match its behavior and information architecture; do not copy its code.
- `content/bible-journey-seed.json`: the source of truth for all plan content.
- `node_modules/next/dist/docs/`: this Next.js version differs from older ones; check the guide before using an API.

## Decisions

Record decisions here, newest last: the date, the decision, and the reason.

- 2026-11-13: The app must run with no environment variables. Signed out, progress lives in IndexedDB. Supabase sync, the study assistant and push reminders each switch on only when their variables are set, and their UI explains what is missing instead of failing. Reason: it has to work locally first, and the owner creates the Supabase, Anthropic and Vercel accounts later.
- 2026-11-13: Stack follows the brief's defaults (Next.js, Tailwind, Supabase, IndexedDB, Web Push, Anthropic Messages API, Vercel, Vitest, Playwright). npm is the package manager.
- 2026-11-13: UI SDK (`@ui-sdk/react`, Vercel Labs, beta, React 19) supplies headless behavior for tabs, the collapsible weeks and dialogs, because the brief requires full keyboard use and those are where hand-rolled behavior goes wrong. If it does not build cleanly on this Next.js version, use native elements (`details`, `dialog`) and record that here. It is not used for the study assistant.
- 2026-11-13: Design work goes through the Impeccable skill: shape the direction in BJ-1 within the brief's design section, critique before the MVP PR.
- 2026-11-13: Bible text shown in the app is KJV from the seed file only. No text from copyrighted translations is embedded; Read online links out to Bible Gateway.
- 2026-11-13: Milestones BJ-1 to BJ-6 match the brief's six milestones. The owner pre-approved the briefs and PR bodies for this run (autopilot to MVP); each PR is reviewed by a three-model panel (Claude, Codex, Cursor) before it merges into `feature/mvp`. Merging `feature/mvp` into `main` is the owner's.
- 2026-11-13: Open questions from the brief, answered with defaults until the owner says otherwise: sign-up is open but the assistant is rate limited per user; week numbers only, no calendar dates; KJV only for memory verses; no weekly email.

## Log

- 2026-11-13: gatework installed
