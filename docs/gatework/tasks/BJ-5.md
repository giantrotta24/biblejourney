---
id: BJ-5
title: PWA, reminders and settings
size: full
status: open
opened: 2026-11-13
---

# BJ-5: PWA, reminders and settings

## Brief

<!-- Gate 1. Small: what, why, done-when, and the test that should fail first. Full: see gw-brief. -->
Intent: the app installs to a phone home screen, Today, Plan and Verses work in airplane mode, the reader can turn a daily reminder on, off and to another time, and choose theme and Read online translation, and reset progress by typing a confirmation word. In scope: manifest and icons, a service worker precaching the app shell and content, offline for everything except the assistant, web push subscribe and unsubscribe, a scheduled reminder job that respects each user's time zone, a settings screen (reminder time, light/dark/system theme, link translation default NIV, reset with typed confirmation), settings stored locally and in profiles when signed in. Out of scope: the assistant, polish pass. Acceptance: all checks pass with no env vars; an offline Playwright test loads Today, Plan and Verses with the network off; reminder scheduling logic covered by unit tests. Live push delivery is not exercised in this run.

## Ruled out

<!-- Dated. Each entry: what was checked, what it showed, and why that rules the candidate out. -->

## Evidence

<!-- Command output, captures, check names, and what was not verified. -->
2026-11-13, branch gw/BJ-5 at edefe86, no app env vars set, .next removed first: npm run lint exit 0; npx next typegen then npm run typecheck exit 0; npm test 12 files, 108 tests passed; npm run build exit 0 (all pages static, /api/reminders/send dynamic, /manifest.webmanifest static); E2E_PORT=3125 npm run e2e 26 passed on 360x780 Pixel 7 Chromium. No service-role, VAPID private key or web-push reference in .next/static. Production pages /, /settings, /plan, /verses log no console errors or warnings, including with a saved dark theme. Watched failing first: due.test.ts 12 failed and send.test.ts 10 failed against not-implemented stubs; reset.test.ts 3 failed against a stub; settings.test.ts 14 failed against stubs. The four new e2e behaviours were each watched failing by breaking the code (service worker not answering navigations: reload offline net::ERR_INTERNET_DISCONNECTED; theme script emptied: data-theme missing when body is parsed; reset word check bypassed: confirm button not disabled; Today link without the setting: version=NIV). The e2e suite passed on first run before those breakages. Offline test proves the network is really off: a fetch to /api/* fails while Today, Plan and Verses render from the service worker, after reload, tab navigation and direct loads. Not verified: install on a real iOS or Android device, a real push delivery (no VAPID keys), the send route against a live Supabase (store queries never executed), the new migration SQL, the scheduled GitHub workflow, profile read/write for signed-in settings, the reminder subscribe/unsubscribe flow in a browser, the service worker update path across two deploys.
2026-11-13 follow-up, gw/BJ-5 at ed6493f after merging origin/gw/BJ-4 (c5eec64), no app env vars, from rm -rf .next: npm run typecheck (next typegen && tsc --noEmit) exit 0; npm run lint exit 0; npm test 18 files, 195 tests passed; npm run build exit 0 (/api/ask and /api/reminders/send dynamic, all pages static); E2E_PORT=3125 npm run e2e 44 passed. Merge conflicts in docs/gatework/context.md (kept both log lines), src/account/session.ts (kept BJ-4 syncAction flow, added settingsSignedIn/settingsSignedOut), src/components/today-view.tsx (kept both imports: link translation and StudyAssistant). Reset across devices: profiles.progress_reset_at in new migration 20261114010000_progress_reset.sql; pull returns resetAt; reset queues a mark-reset op after its deletes; each device remembers the reset marker it last applied (reset_seen in the sync queue meta) and accepts an empty pull from a linked account only when the account carries a reset it has not seen. Watched failing first: the offline-second-device and offline-reset engine tests failed (no marker reached the account) against a no-op markReset; the seen-reset guard test failed with remembering disabled; the offline assistant e2e assertion failed with the offline branch disabled. Not verified: the new column and profile upsert against live Supabase, RLS for progress_reset_at writes, two real devices, a reset racing a tick on another device online.
2026-11-13 second merge-forward, gw/BJ-5 at 006100c after merging origin/feature/mvp (c99fedd), no app env vars, from rm -rf .next: npm run typecheck exit 0; npm run lint exit 0; npm test 19 files, 211 tests passed; npm run build exit 0; E2E_PORT=3125 npm run e2e 48 passed (service workers blocked globally, allowed only in pwa.spec.ts; assistant-stream.spec.ts mocks /api/ask with page.route and passes). The merge applied without conflicts; study-assistant.tsx kept feature/mvp's focus handling and stream-end markers with this branch's online/offline handling. New: going offline with a finished answer keeps the answer visible, shows the offline note in the polite region and marks the triggers aria-disabled; watched that e2e test fail first (the polite region disappeared because the form unmounted). Not verified: a real device going offline mid-stream.

## Log

- 2026-11-13: opened
- 2026-11-13: implemented on gw/BJ-5: versioned hand-rolled service worker (network-first pages, cache-first static assets, /api never cached), manifest and icons, settings screen with pre-paint theme, link translation, typed-word reset, web push reminders sent by a GitHub Actions cron through POST /api/reminders/send
