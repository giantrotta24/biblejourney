---
id: BJ-2
title: Local progress: ticking, current day, strip and stats, IndexedDB
size: full
status: open
opened: 2026-11-13
---

# BJ-2: Local progress: ticking, current day, strip and stats, IndexedDB

## Brief

<!-- Gate 1. Small: what, why, done-when, and the test that should fail first. Full: see gw-brief. -->
Intent: signed out, the reader can run the whole daily loop on a phone. Mark a day read and the next day appears at once; tick or untick any day in the plan; mark a verse known; practice a random unlocked verse; and everything survives a reload.
In scope: a progress store (days and verses as sets of rows, add and remove operations, subscribe) persisted in IndexedDB behind an interface BJ-3 can wrap with sync; current-day logic (first unread day); Today with Mark as read, the week's six checkboxes live, a short confirmation, and the Sunday view when the week's six days are done or per the prototype's rule (deep dive, catch-up list of earlier unread days, verse review); progress strip live (full weeks solid, partial tinted, current week marked with a gentle pulse, segments link to the week in the plan) with percent by chapters, days of 312, verses of 52; Plan with 312 live checkboxes and no lag; Verses with I know it, practice mode over unlocked verses, upcoming verses dimmed; reduced-motion respected.
Out of scope: accounts, sync, assistant, PWA, reminders, settings screen, reset.
Acceptance: lint, typecheck, vitest, build, e2e pass; a Playwright test marks a day read, sees the next day, reloads and still sees it; tone is never "you missed".

## Ruled out

<!-- Dated. Each entry: what was checked, what it showed, and why that rules the candidate out. -->

## Evidence

<!-- Command output, captures, check names, and what was not verified. -->
2026-11-13, branch gw/BJ-2 at 778e583: npm run lint exit 0; npm run typecheck exit 0; npm test 5 files, 48 tests passed; npm run build exit 0, all routes static; npm run e2e (E2E_PORT=3117) passed, 17 tests on 360x780 Pixel 7 Chromium. Watched failing first: progress.test.ts 17 failed against stubs; store.test.ts 9 failed against not-implemented stubs; progress.spec.ts 6 of 7 failed with storage forced to memory (IndexedDB assertions and reload checks), the strip-link test failed with segment links removed. Not verified: Safari/Firefox IndexedDB (private-mode fallback covered only by unit tests), a real phone, plan tick latency on a mid-range device (only per-row subscriptions by design), screen reader output.
2026-11-13, follow-up on gw/BJ-2 after merging feature/mvp: timeline marker follows live progress (currentEraIndex, later era wins on shared weeks, last era when finished); verse controls moved above the text; /plan passes week numbers, not week objects (HTML no longer contains textKJV or deepDive keys); closed hash-linked week stays closed (e2e passes, guards the behavior); hash link focuses the week trigger; under-1% label; strip weeks are outlines, a half-height bar and solid fills with no faded fills, pulse is a scaleY transform so colour never changes and reduced motion disables it; strip contrast of solid phase colours against bg (light 3.42, 7.12, 6.82, 6.27; dark 8.98, 6.43, 4.96, 6.34); safe-area scroll padding; disabled check style; phases in strip text; who's who seed assertions. Checks: typecheck, lint, 60 unit tests, build, 28 e2e all pass. Not verified: real phone, screen reader, disabled-checkbox look (loading state too brief to capture), Safari/Firefox.
2026-11-13, second pass: failed writes are kept and retried (next write, load, online, visibility) with a saved flag on the snapshot and a calm unsaved line, memory fallback counts as unsaved; versionchange closes the connection; navigator.storage.persist() requested after the first tick; Sunday view derives from the highest complete week above the last seen; strip is a roving-tabindex group of 52 named links (arrows, Home, End, Enter, Space) with a focus ring and a taller hit area; a week hash holds back the current-week auto-open only in its own phase. Not verified: memory-fallback recovery without a reload (the page does not reopen IndexedDB), a real iOS eviction, screen reader output for the strip group.

## Log

- 2026-11-13: opened
- 2026-11-13: implemented on gw/BJ-2: IndexedDB progress store behind ProgressPersistence; Sunday view rule taken from the brief because the prototype has none
