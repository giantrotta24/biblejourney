---
id: BJ-3
title: Accounts and sync: Supabase auth, RLS, merge on sign-in, realtime
size: full
status: open
opened: 2026-11-13
---

# BJ-3: Accounts and sync: Supabase auth, RLS, merge on sign-in, realtime

## Brief

<!-- Gate 1. Small: what, why, done-when, and the test that should fail first. Full: see gw-brief. -->
Intent: the reader can sign in with an email magic link or Google and see the same progress on phone and laptop within seconds; signed out still works exactly as before; nothing is ever lost on first sign-in.
In scope: Supabase browser client (no cookies, no middleware, pages stay static); SQL migration for profiles, day_progress, verse_progress, push_subscriptions with row-level security; a sync layer over the BJ-2 ProgressPersistence (union merge on sign-in, row insert and delete, realtime subscription, offline queue flushed on reconnect); an account screen with sign in, sign out and sync status; a calm "accounts are not set up" state when the Supabase variables are absent; README setup steps.
Out of scope: assistant, PWA, reminders, settings beyond account, reset.
Acceptance: lint, typecheck, vitest, build, e2e pass with no environment variables; sync logic is covered by unit tests against a fake remote, including two devices ticking concurrently and a merge that keeps the union. Live Supabase is not exercised in this run and the PR says so.

## Ruled out

<!-- Dated. Each entry: what was checked, what it showed, and why that rules the candidate out. -->

## Evidence

<!-- Command output, captures, check names, and what was not verified. -->
2026-11-13, branch gw/BJ-3 at 01a8f47, no env vars set: npm run lint exit 0; npm run typecheck exit 0; npm test 8 files, 69 tests passed; npm run build exit 0, all routes static including /account; E2E_PORT=3123 npm run e2e 19 passed on 360x780 Pixel 7 Chromium; no service-role reference in .next/static. Watched failing first: engine.test.ts 11 failed against a not-implemented stub; supabase-remote.test.ts 3 failed against stubs; account.spec.ts 2 failed before the account link and screen existed; the stale-pull test failed with the pending-delete filter removed and the realtime test failed with echo suppression removed. queue.test.ts was written after queue.ts and only seen passing. Sync is proven against an in-memory fake RemoteProgress only. Not verified: a live Supabase project, the migration SQL (never executed), RLS policies, magic link and Google OAuth round trips, realtime delivery (including whether DELETE events reach an unfiltered subscription), token refresh, Safari/Firefox IndexedDB, a real phone.
2026-11-13, follow-up on gw/BJ-3 at c68ea5b after merging origin/feature/mvp (2ba459a), no env vars set: rm -rf .next && npm run typecheck exit 0 (next typegen then tsc); npm run lint exit 0; npm test 8 files, 104 tests passed; npm run build exit 0, all routes static; E2E_PORT=3123 npm run e2e 34 passed; no service-role reference in .next/static. Sync writes the device store and the pending-ops queue independently, so a failed device write never drops the remote op and a failed queue write never skips the device write; the store retries the call and sync dedupes per row (and per echoed remote row) so retries do not upload twice. Server refusals (HTTP 4xx except 401, 408, 429) drop the op, keep draining, and are counted for the account screen; network and 5xx errors keep the op and its order. A Sunday view is marked seen when changes from another device read past that week. Watched failing first: 4 new engine tests (echo re-upload, refusal count, retry order, remote listener), the durable pass-through test, the queue count test, the 4xx classification test, the sundayPassedWeek test and the own-echo notification assertion; mutation checks: dropping the echo dedupe fails the retry test, treating refusals as transient fails both refusal tests. Seen passing only: the two both-fail recovery tests (the earlier ordering already met them) and the queue-only failure test. Not verified: anything against a live Supabase project, including the real status codes PostgREST returns for RLS and check violations.
2026-11-13, PR 7 review fix pass on gw/BJ-3 at a5ff0b7, no env vars set: rm -rf .next && npm run typecheck exit 0; npm run lint exit 0; npm test 9 files, 117 tests passed; npm run build exit 0, all routes static; E2E_PORT=3123 npm run e2e 34 passed; no service-role reference in .next/static. Fixes: progress tables removed from supabase_realtime (idempotent drop), changes go out through realtime.broadcast_changes triggers to private topic progress:<user_id>, with a select policy on realtime.messages limited to the user's own topic, and the client listens on a private channel; the remote checks the session user before every pull and write and throws a retryable error otherwise; the engine applies a pull only when it was read as the session user, and on a linked device refuses a pull that would remove every row it can remove; remote changes are deferred (resync later) when the pending queue is unreadable or the row's sync op is not queued yet; realtime events that arrive during a reconcile are buffered and replayed after the snapshot; sync stops whenever the auth callback delivers no session while syncing; keep_earliest_completion pins search_path. Watched failing first: adapter broadcast mapping, topic and session-guard tests (5); engine tests for unqueued untick vs incoming upsert, dropped-session pull, empty signed-in pull, delete during a slow pull, insert during a slow pull (5); first-sign-in-as-user test failed with the userId check removed; syncAction tests (2 of 4); keyboard e2e failed with tabIndex=-1 on the account link. Not verified: the migration SQL has never run; realtime.broadcast_changes signature and payload shape taken from the supabase-js 2.119.0 RealtimeBroadcastPayload types and Supabase docs, not exercised; the Realtime public-access setting; RLS and realtime.messages policies. Check on a live project: user B subscribes to progress:<A id> as a private channel (must fail to join) and to progress:<B id> (joins), then user A ticks and unticks; B must receive nothing, and A's other device must receive INSERT and DELETE.

## Log

- 2026-11-13: opened
- 2026-11-13: implemented on gw/BJ-3: Supabase schema with RLS, sync engine over ProgressPersistence (union on first sign-in, follows the account on a restored session, IndexedDB pending queue, realtime apply), account screen behind a header link
- 2026-11-13: follow-up: merged feature/mvp; device retry and sync queue reconciled; server refusals dropped and counted; Sunday view skipped when another device read past it
- 2026-11-13: PR 7 review fix pass: private broadcast per user, session-checked sync, mid-pull buffering, unqueued-change deferral
