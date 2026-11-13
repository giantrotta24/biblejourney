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
- 2026-11-13: BJ-1: UI SDK spike succeeded. @ui-sdk/react and @ui-sdk/core 0.1.0-beta.1 install, typecheck and build on Next 16.4.6 with Cache Components; Accordion drives the Plan weeks (multiple, controlled, controller opens the week named in the URL hash) and SegmentedControl drives the verse modes. The section tabs stay a plain nav of links with aria-current, because each tab is a route and a page nav is not an ARIA tablist.
- 2026-11-13: BJ-1: Impeccable shape ran in fallback mode (its launcher downloads a binary on first run, which the agent did not do); direction taken from the brief: hairline rules over cards, phase colour only in the strip, phase swatches and timeline nodes, no coloured left-border card, no eyebrow labels above headings. Sand darkened to #a87d22 in light mode so strip segments clear 3:1 against the background.
- 2026-11-13: BJ-2: the prototype has no Sunday view; it shows when reading stops at a fully read week's Saturday, until the reader continues (per-device localStorage marker). Unlocked verses are weeks 1 through the current week, as in the prototype.
- 2026-11-13: closed task BJ-1: Foundation shipped in PR 5: seed validation, theme tokens, five static screens, Playwright smoke in CI
- 2026-11-13: BJ-3: first sign-in merges as a union; after that, while the device stays linked to the account, a restored session follows the account (rows absent remotely with no pending op are removed locally) so a day unticked on another device is not re-added. Sign-out unlinks the device and keeps local progress.
- 2026-11-13: BJ-4: the study assistant streams plain text (text/plain; charset=utf-8) from POST /api/ask; errors before the stream are JSON {error, code}; GET /api/ask reports {configured, signInRequired} so Today can show the right state without a request. The limit is per UTC day and counts only model calls; cached quick-prompt answers are free. ASSISTANT_ALLOW_ANONYMOUS=1 works only outside production.
