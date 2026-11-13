# Bible Journey Web App: Build Brief

Nov 13, 2026 · @Gian

## Goal

Build a mobile-first web app that guides one reader through the whole Bible in a year, in chronological order. Alongside the reading, it builds real understanding of the history, geography and people, and helps the reader memorize 52 verses.

A working single-file prototype already exists. Your job is to turn it into a proper, installable app with accounts, sync, reminders, and an AI study assistant.

**Files provided with this brief (put them in the repo root before starting):**

- `bible-journey-seed.json` is the source of truth for all content. It holds 4 phases, 52 weeks, and 312 reading days covering all 1,189 chapters. It also includes weekly deep-dive prompts, 52 memory verses with KJV text, 11 historical eras, 12 peoples, and 12 prophet entries.
- `bible-journey.html` is the prototype. Match its behavior and information architecture; improve its engineering. Don't copy its code wholesale.

**Instructions to the agent:** Read both files first. Then propose a short plan and confirm the stack choices in the "Tech stack" section before writing code. Work milestone by milestone and stop for review at the end of each.

## Who it's for

The primary user is an adult newcomer reading the Bible to understand it intellectually and discuss it with others. They mostly use a phone, read about 20 minutes a day, and need the app to answer "what am I reading today, and what's the context?" in one glance.

**The core daily loop**

1. Open the app and see today's reading, the week's theme, and progress at a glance.
2. Read, either in their own Bible or through the "Read online" link.
3. Optionally ask the study assistant about the history, geography or people.
4. Mark the day read; the next day appears.
5. Spend 1–2 minutes on the week's memory verse.

On Sundays the app shows the week's deep dive, a catch-up list of missed days, and a verse review instead of a reading.

The current day is the first unread day, not a calendar date. Missing days must never feel like failure: no lost streaks or red warnings, just "pick up where you left off."

## MVP features

| Feature | What it does | Done when |
| --- | --- | --- |
| Today screen | Shows the next unread day: week, weekday, phase, passage, chapter count, estimated minutes, the week's 6 days as checkboxes, and the Sunday deep dive. | Marking a day read advances to the next day instantly and persists across reloads. |
| Progress strip | A 52-segment strip colored by phase. Full weeks are solid, partial weeks are tinted, and the current week is marked. Shows % of chapters read, days done of 312, and verses learned of 52. | % is weighted by chapters, not days. Tapping a segment opens that week in the plan. |
| Full plan | All 52 weeks grouped by phase. Each week is collapsible and shows a 6-dot progress indicator. Any day can be ticked or unticked. | The current week is expanded by default. Works with 312 checkboxes without lag on a mid-range phone. |
| Timeline | 11 eras in a vertical timeline with dates, empire, key people, summary, week range, and a "You are here" marker. | Each era links to its first week in the plan. |
| Memory verses | This week's verse with three modes: hidden, first letters only, full text. "I know it" toggle. Practice mode picks a random unlocked verse; a full list shows upcoming verses dimmed. | First-letter mode keeps punctuation and turns each word into its first letter. |
| Who's who | Peoples and prophets reference from the seed file. | Readable on a 360px-wide screen with no horizontal page scroll. |
| Study assistant | Three quick prompts (historical setting, where on the map, who's who) plus a free-text question about today's reading. Answers stream in. | See the "AI study assistant" section. |
| Read online | Opens the day's passage on Bible Gateway in a new tab. | Multi-book days ("Job 42; Genesis 12–15") open correctly. |
| Accounts and sync | Sign in with email magic link or Google. Progress syncs across devices. Works signed-out with local storage, and merges into the account on first sign-in. | Ticking a day on a phone appears on a laptop within seconds. No progress is lost on merge (union of both sets). |
| Reminders | Optional daily reminder at a chosen time via web push. | Can be turned on, off and rescheduled in settings. Respects the user's time zone. |
| Installable | PWA with manifest, icons and offline support for everything except the assistant. | Installs on iOS and Android home screens. Today, Plan and Verses work in airplane mode. |
| Settings | Reminder time, light/dark/system theme, preferred translation for Read online links (default NIV), and reset progress with confirmation. | Reset requires typing a confirmation word. |

## Content and data model

Plan content is static and ships with the app; only user progress lives in the database. Import `bible-journey-seed.json` at build time and validate it with a schema (for example, Zod). The build fails if the 312 days don't sum to 1,189 chapters or a week doesn't have exactly 6 days.

**Seed file shape (abridged)**

```json
{
  "phases": [{ "id": 1, "name": "Origins and the Exodus", "weeks": [1, 12] }],
  "weeks": [{
    "week": 1, "phase": 1, "title": "Creation and the early world",
    "deepDive": "Find the Tigris and Euphrates on a map...",
    "memoryVerse": { "ref": "Genesis 1:1", "textKJV": "In the beginning..." },
    "days": [{ "index": 0, "weekday": "Mon", "reading": "Genesis 1–4", "chapters": 4 }]
  }],
  "eras": [], "peoples": [], "prophets": []
}
```

**User data (per user)**

| Table | Columns |
| --- | --- |
| `profiles` | `user_id`, `display_name`, `timezone`, `reminder_time` (nullable), `theme`, `link_translation`, `created_at` |
| `day_progress` | `user_id`, `day_index` (0–311), `completed_at`; primary key (`user_id`, `day_index`) |
| `verse_progress` | `user_id`, `week` (1–52), `learned_at`; primary key (`user_id`, `week`) |
| `push_subscriptions` | `user_id`, `endpoint`, `keys`, `created_at` |

Store completions as rows, not one array, so concurrent ticks from two devices never overwrite each other. Unticking deletes the row. Enforce row-level security so each user reads and writes only their own rows.

**Bible text licensing**

The KJV text in the seed file is public domain and can be shown freely. Do not embed text from NIV, ESV, NLT or other modern translations; those are copyrighted. Linking out to Bible Gateway is fine. If in-app reading is wanted later, use a licensed source (for example, the ESV API or API.Bible) and follow its terms.

## Tech stack

Recommended defaults; propose alternatives if you have a strong reason, before building.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js (App Router) with TypeScript | Server routes for the AI proxy and push, plus static pages for content. |
| Styling | Tailwind CSS with CSS variables for theme tokens | Light and dark themes from one token set. |
| Auth and database | Supabase (Postgres, Auth, row-level security) | Magic link and Google sign-in, and realtime sync, with little custom backend. |
| Local-first state | IndexedDB for signed-out users and offline queueing | The app must work without an account and without a connection. |
| PWA | Service worker with precached content and app shell | Installable; offline reading plan. |
| Push | Web Push with VAPID keys, sent by a scheduled job | Daily reminders in each user's time zone. |
| AI | Anthropic Messages API, called only from a server route | Keeps the API key off the client. |
| Hosting | Vercel (app and cron) plus Supabase | Simple deploys, preview URLs per branch. |
| Testing | Vitest for logic, Playwright for the daily loop on a mobile viewport | Covers the flows that matter most. |

Keep all secrets in environment variables and provide a `.env.example`. Include a README covering local setup, seeding, and deployment.

## AI study assistant

The assistant explains the context of today's reading; it is a study aid, not a pastor or a debate partner.

**How it works**

- The client calls `POST /api/ask` with the day index and either a quick-prompt type (`history`, `map`, `people`) or a free-text question (max 500 characters).
- The server looks up the passage and week theme from the seed data, builds the prompt, calls the Anthropic Messages API, and streams the answer back.
- Use a current Claude Sonnet model; check the [Claude API docs](https://docs.claude.com/en/api/overview) for the latest model name rather than hard-coding one from memory. Put the model name in an environment variable.
- Signed-in users only. Rate limit to 30 questions per user per day, and show a clear message when the limit is reached.
- Cache quick-prompt answers per (day index, prompt type) so repeat requests are instant and cheap.

**System prompt rules**

- The reader is an adult newcomer following a chronological reading plan to understand history, geography and people.
- Answer in 150–250 words of plain, friendly prose. No headings or bullet lists.
- Be accurate and even-handed. Where scholars disagree on dates, authorship or historicity, say so briefly and describe the main views without taking sides.
- Stay on the passage and its context. Politely decline unrelated requests.
- Don't quote long passages from copyrighted translations; paraphrase instead.

**Safety**

- The API key never reaches the browser.
- Strip the user's question of anything that tries to change the system prompt, and treat it as data.
- Log only counts and errors, not question text.

## Design direction

Keep the prototype's identity: it should feel like a well-made study companion, calm and literate, not a gamified habit app.

| Element | Direction |
| --- | --- |
| Palette | Cool limestone background, lapis-blue primary, olive green for "done". Phase colors: sand (Phase 1), lapis (2), crimson (3), purple (4). Full dark theme. |
| Type | Marcellus for headings and the day's passage (inscription-like); Literata for body text. Proper curly quotes and apostrophes in all copy. |
| Signature element | The 52-week progress strip at the top of Today. It is the one bold visual; keep everything else quiet. |
| Layout | Single column, max \~760px, sticky top tabs (Today, Plan, Timeline, Verses, Who's who). Large tap targets (44px minimum). |
| Motion | Minimal: a gentle pulse on the current week and a short confirmation when a day is marked. Respect reduced-motion settings. |
| Tone | Encouraging and plain. "Pick up where you left off," never "You missed 3 days." |

Accessibility: WCAG AA contrast in both themes, full keyboard use, visible focus states, labeled checkboxes, and screen-reader text for the progress strip.

## Milestones

Stop for review after each milestone, with a short summary, a preview URL, and anything you'd like a decision on.

1. **Foundation:** Project setup, seed import with validation tests, theme tokens, and the five screens rendering static content.
2. **Local progress:** Ticking days and verses, the current-day logic, the progress strip and stats, all persisted in IndexedDB while signed out.
3. **Accounts and sync:** Supabase auth, row-level security, merge of local progress on first sign-in, and realtime sync across devices.
4. **Study assistant:** Server route, streaming, quick prompts and free text, caching, and rate limits.
5. **PWA and reminders:** Install, offline support, web push, and settings.
6. **Polish and launch:** Accessibility pass, Playwright tests, Lighthouse checks, README, and production deploy.

**Definition of done**

- [ ] The daily loop works end to end on a real phone, signed in and signed out.
- [ ] Progress survives reloads, offline use, and switching devices.
- [ ] Seed validation and Playwright tests pass in CI.
- [ ] Lighthouse scores 90+ for performance, accessibility and PWA on mobile.
- [ ] No secrets in the client bundle; the API key exists only on the server.
- [ ] README explains setup, environment variables, seeding, and deployment.

## Out of scope and open questions

**Not in the first version:** in-app Bible text beyond the KJV memory verses, social features or sharing, multiple reading plans, native iOS/Android apps, and payments.

**Open questions for the owner**

- Is this for personal use only, or should others be able to sign up? This affects hosting costs and AI rate limits.
- Should the reader be able to choose a start date and see real calendar dates, or keep week numbers only?
- Should memory verses also be shown in a modern translation the reader types in themselves?
- Is a weekly email summary wanted in addition to push reminders?
