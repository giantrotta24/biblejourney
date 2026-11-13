---
id: BJ-6
title: Polish and launch: carried review findings, design critique, accessibility, README
size: full
status: open
opened: 2026-11-13
---

# BJ-6: Polish and launch: carried review findings, design critique, accessibility, README

## Brief

<!-- Gate 1. Small: what, why, done-when, and the test that should fail first. Full: see gw-brief. -->
Intent: the MVP is ready for the owner to merge and deploy: every carried review finding is closed, the UI has had an Impeccable critique and polish pass within the brief's design direction, accessibility holds in both themes, and the README takes a new person from clone to a deployed app. Out of scope: new features, changing the stack, anything needing live Supabase, Anthropic or push credentials. Acceptance: all checks pass from a clean .next with no env vars; an automated axe scan of every route in light and dark has no serious or critical violations; Lighthouse mobile scores recorded for a production build.

Carried findings (items marked ASSIGNED TO BJ-5 are already done there; verify only):
# BJ-6 backlog (carried review findings)

From Cursor's review of PR 6 (BJ-2), not yet applied:
1. [Major] Mark as read leaves focus on the button: in src/components/today-view.tsx the focus effect reruns only when `view` changes, so for Mon–Fri the new passage heading never takes focus and a screen-reader user is not told the passage changed. Depend on the passage identity (today's index plus the Sunday week). The tabIndex=-1 headings use `focus:outline-none`; give them an explicit visible `:focus` outline instead. Add an e2e assertion that the heading is focused after Mark as read on a weekday.
2. [Minor] `useCurrentDayIndex` in src/components/week-days.tsx makes every mounted DayCheckbox re-render when the current day changes. Select a boolean (`currentIndex === dayIndex`) like `useDayDone`.
3. [Minor] Store mutations before `load()` resolves: `removeDay` returns early when the day is not yet in the map, so an untick during load is dropped and the late union restores it; `addDay` can overwrite the earliest timestamp. Make addDay/removeDay/addVerse/removeVerse/merge wait for the in-flight load. Unit test mutating before `await store.load()`.
4. [Product] Week 52 never gets a Sunday view (finished state replaces it). Show the last week's deep dive on the finished screen.
5. [Design tension] Strip segments are ~6px wide at 360px; 52 weeks on screen and 44px targets cannot both fit. Keyboard path exists (roving tabindex). Decide in the Impeccable critique: keep strip as overview and make a tap on the strip open the plan at the nearest week with a forgiving hit area, or add a scrollable row.

Open verification notes for the MVP PR body:
- PostgREST status for RLS refusal (401 would retry forever).
- Nothing run against live Supabase, Anthropic or push.

From the BJ-3 fix pass:
6. [ASSIGNED TO BJ-5 follow-up pass] [Major, cross-feature] The sync engine now treats an authenticated pull that would remove every local row as suspect and keeps local rows (status offline). That breaks Reset progress across devices (BJ-5 reset deletes all remote rows; an offline second device will never accept the empty account). Fix: record a `progress_reset_at` timestamp on `profiles` when the reader resets (new migration), return it with the pull, and accept an empty pull when `progress_reset_at` is newer than this device's last successful sync; otherwise keep the suspect guard. Tests both ways.

From Cursor's review of PR 7 (BJ-3), src/components/account-panel.tsx:
7. [Major] After a refused change the status still says "up to date on every device". When the rejected count is above zero, replace the synced sentence with the refusal inside the existing mounted role=status paragraph (body size, text-ink) so it is announced.
8. [Major] Sending the magic link and signing out unmount the focused control and drop focus. Keep one status paragraph mounted in the sign-in view, give it tabIndex=-1 and focus it (preventScroll) when the link is sent; on sign-out focus the Account h1.
9. [Minor] Email button has no waiting state: label "Sending a link…", aria-busy, disable Continue with Google while sending, add a `.btn:disabled` treatment next to `.check:disabled`.
10. [Minor] A long email address can widen the page: `overflow-wrap: anywhere` on the confirmation and "Signed in as" lines.

From BJ-5 follow-up:
11. [ASSIGNED TO BJ-5] [Minor] Going offline while an assistant answer is on screen replaces the answer with the offline message. Keep a finished answer visible; show the offline note beside it.

From Cursor's review of PR 8 (BJ-4), src/components/study-assistant.tsx (focus handoff and the live region were already fixed in the BJ-4 fix pass; verify, then do the rest):
12. Render Stop with the prompt buttons, above the answer, so a growing answer never pushes it off screen; keep the "Looking into today's reading…" line until the stream ends.
13. The "Sign in" link in the signed-out and expired states is ~27px tall: make it `inline-flex min-h-11 min-w-11 items-center`.
14. A finished stream with no text (complete marker, empty body) clears the panel silently: show the existing error notice instead. Test.

## Ruled out

<!-- Dated. Each entry: what was checked, what it showed, and why that rules the candidate out. -->

## Evidence

<!-- Command output, captures, check names, and what was not verified. -->
Carried findings: 1 heading focus on each new passage (e2e progress.spec "marking a day read"), visible :focus outline on tabIndex=-1 headings; 2 useIsCurrentDay boolean selector; 3 store mutations wait for in-flight load (store.test "mutations while loading"); 4 finished screen shows week 52 deep dive (e2e); 5 strip keeps overview, 1.5px strokes with gaps, 56px tall with ~79px hit area, caption names and links the current or pointed week; 6 verified (engine.test reset cases, migration 20261114010000); 7-10 account panel (account-panel.test.tsx, happy-dom); 11 verified (assistant-stream.spec offline test); 12-14 assistant Stop placement, loading line, sign-in target, empty answer (assistant-stream.spec); 15 reset dialog z-index, max-height, safe area, Enter (settings.spec); 16 theme control lapis pill 7.1:1 light / 7.8:1 dark (settings.spec); 17 orientation removed (settings.spec); 18 select w-full min-w-0 (did not reproduce in Chromium at 360px before the fix); 19 theme-color follows the chosen theme (settings.spec).
Impeccable: launcher context ran; critique dual-agent (A design review 28/40, B detector 1 finding layout-transition on accordion height, overlay on 5 pages); polish applied; final detector run: same single layout-transition finding, kept.
axe: e2e/a11y.spec.ts, 7 routes plus Today mid-plan, Sunday and finished, light and dark: 0 serious or critical.
Lighthouse 12.8.2 mobile, local production build: / 91, /plan 96, /verses 96, /timeline 97, /whos-who 97, /settings 95, /account 97 performance; accessibility, best practices and SEO 100 on all; CLS 0 to 0.018 (plan was 0.168 before pre-opening week 1).
Acceptance from clean .next, no env vars: typecheck 0, lint 0, vitest 24 files 234 tests passed, build ok, e2e 66 passed.
Not verified: real phone, live Supabase/Anthropic/push, screen reader by ear, 312 checkboxes on a mid-range phone.

## Log

- 2026-11-13: opened
- 2026-11-13: implemented at a4a253e; merged origin/feature/mvp
