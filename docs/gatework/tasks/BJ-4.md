---
id: BJ-4
title: Study assistant: server route, streaming, quick prompts, cache, rate limit
size: full
status: open
opened: 2026-11-13
---

# BJ-4: Study assistant: server route, streaming, quick prompts, cache, rate limit

## Brief

<!-- Gate 1. Small: what, why, done-when, and the test that should fail first. Full: see gw-brief. -->
Intent: on Today the reader taps one of three quick prompts (historical setting, where on the map, who's who) or types a question about today's reading and a 150 to 250 word answer streams in. In scope: POST /api/ask per the brief (day index plus prompt type or free text up to 500 chars), server-built prompt from seed data, Anthropic Messages API streaming with the model name from ANTHROPIC_MODEL, signed-in only via the Supabase access token, 30 questions per user per day with a clear limit message, quick-prompt answers cached per day index and type, question treated as data, logs carry counts and errors only, calm not-set-up and signed-out states. Out of scope: PWA, reminders, settings. Acceptance: all checks pass with no env vars; route logic covered by unit tests with a fake model client; no key in the client bundle. Live Anthropic and Supabase calls are not exercised in this run.

## Ruled out

<!-- Dated. Each entry: what was checked, what it showed, and why that rules the candidate out. -->

## Evidence

<!-- Command output, captures, check names, and what was not verified. -->
2026-11-13, branch gw/BJ-4 at e7ce2d7, no env vars set: npm run lint exit 0; npm run typecheck exit 0 (after npx next typegen); npm test 13 files, 103 tests passed; npm run build exit 0, /api/ask dynamic, every page static; E2E_PORT=3124 npm run e2e 21 passed on 360x780 Pixel 7 Chromium, including Today showing the not-set-up state with no console errors, GET /api/ask {configured:false,signInRequired:true}, POST 503, and no ANTHROPIC_API_KEY, SUPABASE_SERVICE_ROLE_KEY or @anthropic-ai/sdk string in .next/static. Watched failing first: prompt and store tests 14 failed against not-implemented stubs; handler tests 11 failed against a stub; assistant.spec.ts failed before the panel existed. model.test.ts and supabase-stores.test.ts were written alongside their modules; model.test failed once on a wrong header assumption (SDK 1.8 sends the key as Authorization: Bearer). Local run against a mock Anthropic SSE server on 127.0.0.1 with next dev and ASSISTANT_ALLOW_ANONYMOUS=1: requests carried model claude-sonnet-5-5, effort low, fallbacks default with server-side-fallback-2026-07-01; text streamed in chunks; repeat quick prompt returned x-assistant-cache hit without a model call; a cut-off stream was not cached; 501 chars returned 400; logs held counts only; in a browser the Stop button stopped a stream, the character count updated, offline showed the offline notice, targets were 44px, no horizontal scroll, no console errors. Not verified: a live Anthropic call, answer quality and length against the system prompt, refusal and fallback behavior, a live Supabase project, the assistant migration SQL (never executed), the RPC, RLS on the new tables, token verification with a real access token, the signed-in UI path, a real phone, Safari streaming.
2026-11-13 follow-up: merged origin/gw/BJ-3 (8491114) into gw/BJ-4 with no conflicts; the panel stays in ReadingView only. Rate-limit copy is now: You’ve asked 30 questions today. The assistant will be ready again tomorrow. Added a handler test that the 401, 429, 502 (model and auth failure) and mid-stream error paths never log question or answer text; it passed on first run, and failed when errorName was temporarily made to include error.message, then restored. Added an e2e check that the panel is absent on the Sunday view and back on week 2. At fcfce84, no env vars, from rm -rf .next: npm run typecheck exit 0 (next typegen && tsc --noEmit); npm run lint exit 0; npm test 13 files, 139 tests passed; npm run build exit 0, /api/ask dynamic, all pages static; E2E_PORT=3124 npm run e2e 37 passed. Not verified: unchanged from the first pass (live Anthropic, live Supabase and the migration, signed-in path, real phone, Safari streaming).

## Log

- 2026-11-13: opened
- 2026-11-13: implemented on gw/BJ-4: POST /api/ask streaming plain text from the Anthropic Messages API (default claude-sonnet-5-5 in src/assistant/config.ts), Supabase token auth, 30 a UTC day limit, quick-prompt cache, assistant tables migration, panel on Today
