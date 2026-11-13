---
id: BJ-1
title: Foundation: seed validation, theme tokens, five static screens
size: full
status: open
opened: 2026-11-13
---

# BJ-1: Foundation: seed validation, theme tokens, five static screens

## Brief

<!-- Gate 1. Small: what, why, done-when, and the test that should fail first. Full: see gw-brief. -->
Intent: a reader opening the app on a phone sees the five screens (Today, Plan, Timeline, Verses, Who's who) rendering real plan content from the seed, in the brief's visual identity, light and dark. No progress tracking yet.
In scope: Zod schema for content/bible-journey-seed.json with build-failing invariants (312 days, 1,189 chapters, 6 days per week, 52 weeks, contiguous indexes); typed content module; theme tokens as CSS variables with light, dark and system; Marcellus and Literata via next/font; sticky top tabs as real routes; five screens with static content including the 52-segment strip (all empty) and Read online links; UI SDK spike for collapsible weeks and dialogs; Playwright smoke test on a mobile viewport wired into CI.
Out of scope: ticking, persistence, accounts, assistant, PWA, reminders, settings.
Acceptance: lint, typecheck, vitest, build and Playwright pass locally; a deliberately broken seed fails the build; no horizontal scroll at 360px on any screen; both themes meet AA contrast for body text.

## Ruled out

<!-- Dated. Each entry: what was checked, what it showed, and why that rules the candidate out. -->

## Evidence

<!-- Command output, captures, check names, and what was not verified. -->
2026-11-13, branch gw/BJ-1, after the last code change (c2aa290):
- npm run lint: exit 0 (eslint ., no findings)
- npm run typecheck: exit 0
- npm test: Test Files 3 passed (3), Tests 22 passed (22)
- npm run build: exit 0, 6 routes prerendered static (/, /plan, /timeline, /verses, /whos-who, /_not-found)
- npm run e2e: 10 passed on a 360x780 Pixel 7 Chromium viewport (route headings and content, aria-current tab, no horizontal scroll at 360px on all five routes, Today reading and Bible Gateway href, Plan accordion via keyboard, timeline link opens week 13, verse modes, dark theme plus data-theme override)
- Broken seed (week 1 Monday chapters 4 -> 5): npm run build exit 1 "Failed to collect configuration for /" with ZodError "Reading days must cover 1,189 chapters, found 1,190"; npm test exit 1, "parses as it ships" and plan.test.ts fail with the same message. Seed restored with git checkout.
- Tests watched failing first: seed invariant tests (8 failed against a schema with no refinements), reading helpers (8 failed against stubs); e2e timeline-hash and verse-mode tests failed with the hash handler and firstLetters disabled, then passed once restored.
- Token contrast (computed from hex): light ink/bg 14.63, muted/bg 6.33, lapis/bg 7.12, text on lapis button 7.77; dark ink/bg 15.36, muted/bg 8.23, lapis/bg 7.82; phase colours vs background 3.42 to 8.98 (non-text).
Not verified: an automated axe/contrast scan of rendered pages; Safari and Firefox (light-dark() and the accordion were only exercised in Chromium); the CI e2e job on GitHub (not pushed); a real phone; text over the 0.16-opacity strip fill.

## Log

- 2026-11-13: opened
- 2026-11-13: implemented on gw/BJ-1; UI SDK used for the Plan accordion and verse modes; Impeccable shape run in fallback mode
