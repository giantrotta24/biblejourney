# Bible Journey

Bible Journey is a mobile-first web app that takes one reader through the whole Bible in a year, in the order events happened. The plan has 52 weeks, 312 reading days and 1,189 chapters. Each week also has a Sunday deep dive and a memory verse, and the app has a timeline of eras and a who’s-who of people and prophets.

Today always shows the first unread day, not a calendar date. Missing a day is never treated as failure.

The plan content lives in [`content/bible-journey-seed.json`](content/bible-journey-seed.json). It is built into the app, so there is no database seeding step. `npm test` validates it against the schema in `supabase/functions/_shared/content/schema.ts` (`supabase/functions/_shared/content/seed.test.ts`); run that after editing the file. The original build brief and the single-file prototype are in [`docs/reference/`](docs/reference/).

## Run it locally

You need Node 22.18 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. No environment variables are needed. Signed out, progress is saved in the browser (IndexedDB) on this device.

Accounts, the study assistant and reminders each switch on only when their variables are set. Until then, each screen says the feature isn’t set up, and everything else works.

## Checks

```bash
npm run lint
npm run typecheck
npm test          # Vitest unit tests
npm run build
npm run e2e       # Playwright; builds and starts the app on port 3100
```

Set `E2E_PORT` to run the end-to-end tests on another port, for example `E2E_PORT=3126 npm run e2e`. The first time, install the browser with `npx playwright install chromium`.

The end-to-end tests include an accessibility scan (`e2e/a11y.spec.ts`). It runs axe on every route in the light and dark themes and fails on any serious or critical violation.

CI (`.github/workflows/ci.yml`) runs all five on every pull request, with no environment variables.

## Environment variables

Copy `.env.example` to `.env.local` for local development, and add the same values to the Vercel project for a deploy. Variables that start with `NEXT_PUBLIC_` are built into the page, so rebuild or redeploy after changing them. Every other variable stays on the server.

| Variable | Feature | Where to get it | Server or public |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Accounts and sync; also needed by the assistant | Supabase → Project Settings → API → Project URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Accounts and sync; also needed by the assistant | Supabase → Project Settings → API → anon public key | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Assistant access, limit, cache, flags and reports; reminders | Supabase → Project Settings → API → service_role key | Server |
| `ANTHROPIC_API_KEY` | Study assistant | [console.anthropic.com](https://console.anthropic.com) → API keys | Server |
| `ANTHROPIC_MODEL` | Study assistant (optional) | Defaults to `claude-sonnet-5-5` | Server |
| `ANTHROPIC_SCREEN_MODEL` | Study assistant screen and answer check (optional) | Defaults to `claude-haiku-5-5` | Server |
| `ASSISTANT_ALLOW_ANONYMOUS` | Trying the assistant locally without accounts | Set to `1`; ignored in production | Server |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Reminders | `npx web-push generate-vapid-keys` | Public |
| `VAPID_PRIVATE_KEY` | Reminders | The same command | Server |
| `VAPID_SUBJECT` | Reminders | A `mailto:` address push services can contact | Server |
| `CRON_SECRET` | Reminders | Any long random string, for example from `openssl rand -hex 32` | Server |

GitHub needs these too, under Settings → Secrets and variables → Actions:

| Name | Kind | Used by |
|---|---|---|
| `APP_URL` | Variable | `reminders.yml`: the production address, such as `https://your-app.vercel.app` |
| `CRON_SECRET` | Secret | `reminders.yml`: the same value as in Vercel |

## Supabase database

Run the six migrations in [`supabase/migrations/`](supabase/migrations/) in this order. Either paste each file into the Supabase SQL editor and run it, or link the project with `supabase link --project-ref <ref>` and run `supabase db push`, which runs them in order. For an existing project where these were applied by hand, first repair migration history as described under Server on Supabase Edge Functions below, before running `db push`. Keep future migrations additive.

1. `20261113000000_init.sql`: the `profiles`, `day_progress`, `verse_progress` and `push_subscriptions` tables, with row-level security and a profile for each new user. It also sets up private Realtime Broadcast channels, one per user (`progress:<user id>`), with a policy so each user can only listen to their own. The progress tables are deliberately not in the `supabase_realtime` publication, because Postgres Changes would send every user’s deletes to everyone.
2. `20261113010000_assistant.sql`: `assistant_usage`, `assistant_answers` and the functions that keep the assistant’s daily limit. Only the service role key can use them.
3. `20261114000000_reminders.sql`: `profiles.last_reminded_on`, which keeps a reader to one reminder a day.
4. `20261114010000_progress_reset.sql`: `profiles.progress_reset_at` and the `reset_progress()` function. Sync reads the reset time with every pull, so accounts need this one too.
5. `20261114020000_assistant_access.sql`: `assistant_access`, the accounts the owner has invited to use the assistant. Row-level security has no policies; only the service role and database owner can use it.
6. `20261115000000_assistant_safety.sql`: `assistant_flags` and `assistant_reports`. Same lockdown as `assistant_access`. Run this before the assistant’s screen and report path can store anything. Paste it into the SQL editor, or let `supabase db push` run it with the others.

## Accounts and sync

Signing in is optional. To turn accounts on:

1. Create a project at [supabase.com](https://supabase.com) and run the migrations above.
2. In Authentication → URL Configuration, set the Site URL to your production address. Add each address you sign in from to Redirect URLs, ending in `/account`, for example `http://localhost:3000/account` and `https://your-app.vercel.app/account`. A wildcard such as `https://*-your-team.vercel.app/account` covers preview deploys.
3. In Authentication → Email Templates, update both **Magic Link** and **Confirm signup** to include the code, `{{ .Token }}`, alongside the existing link, `{{ .ConfirmationURL }}`. Readers enter the 6–10 digit code in the app; on a phone’s home-screen app, this keeps sign-in there because the link opens in the browser. The link still works for browser sign-in.
4. In Realtime → Settings, turn off “Allow public access”. The app only uses private channels.
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then restart `npm run dev` or redeploy.

Supabase’s built-in email service allows only a few emails an hour. Configure a custom SMTP sender in Authentication to lift that built-in limit; resend cooldowns and your sender’s limits still apply. If an email was sent recently, the app explains the wait and keeps the code field available.

To offer Google, enable it in Authentication → Sign In / Providers and paste a client ID and secret from a Google Cloud OAuth client (type Web application). In Google Cloud, add the callback URL that Supabase shows on that page as an authorized redirect URI.

On first sign-in, anything already marked on the device is merged into the account. The merge keeps everything from both, with the earliest time each day or verse was marked. Changes made offline wait on the device and send when the connection returns. A change the server refuses outright is dropped, and the Account screen says how many. Signing out keeps progress on the device. If a live update is missed, the app pulls the account again when the connection returns or the tab comes back into view.

## Study assistant

On Today, a signed-in reader whom the owner has enabled can tap Historical setting, Where on the map or Who’s who, or type a question of up to 500 characters. Quick prompts still stream in from `POST /api/ask`. Other signed-in readers see “The study assistant is by invitation for now.” Sign-up and everything else in the app stay open.

A typed question goes to a smaller model first (`ANTHROPIC_SCREEN_MODEL`, default `claude-haiku-5-5`). Questions about the Bible, faith, or the reading, including hard ones, are answered by the main model. That answer is checked by the same small model, and Today shows the whole reply at once. The line “Looking into today’s reading…” stays on screen while it waits.

A question that is off topic, asks for something sexual or hateful beyond the text, or tries to change the assistant’s rules comes back as the usual decline. It still counts toward the day’s 30. If the reader may be in danger, the main model is not called. The reply is a fixed note with links to call or text 988 in the US, to call 911 or the local emergency number, and to talk with a pastor or someone they trust. That question is not counted. If the screen or the check fails, Today shows the usual “couldn’t answer just now” error and no answer text. A screen failure is not counted. A failed check still counts.

In production the assistant turns on only when `ANTHROPIC_API_KEY`, both `NEXT_PUBLIC_SUPABASE_` variables and `SUPABASE_SERVICE_ROLE_KEY` are set. If any is missing, it stays off and the server logs one line naming what is missing. The server verifies the reader’s Supabase access token and checks `assistant_access` on every question, before the cache, daily limit or model. An access lookup error denies access and logs only the error name. `GET /api/ask` also reports `enabled` for a verified bearer token, so Today can check before showing the prompts.

Run `20261114020000_assistant_access.sql` first. Then use the Supabase SQL editor to grant access, replacing `reader@example.com` with the reader’s email. The account must already exist in Authentication; if the email does not match an account, the insert adds nothing. Running it again keeps the existing grant.

```sql
insert into public.assistant_access (user_id, note)
select id, 'Invited by owner'
from auth.users
where lower(email) = lower('reader@example.com')
on conflict (user_id) do nothing;
```

To revoke access (effective on the next request, including cached answers):

```sql
delete from public.assistant_access as access
using auth.users as users
where access.user_id = users.id
  and lower(users.email) = lower('reader@example.com');
```

To list everyone with access:

```sql
select users.email, access.user_id, access.granted_at, access.note
from public.assistant_access as access
join auth.users as users on users.id = access.user_id
order by access.granted_at desc;
```

The browser cannot read or change this table, so readers cannot enable themselves. Keep the service role key on the server.

Each reader gets 30 questions per UTC day. The count is kept in Supabase, so the limit holds across server instances. Quick prompts count too. A cached answer is free: the same quick prompt for the same day, model and prompt version comes back without calling the model. A request cancelled before the model starts, or during the screen, doesn’t count. Server logs carry counts and error names, never question or answer text.

Questions and answers are not stored. The exception is a report. Under a finished answer, Report this answer can send that answer, the typed question when there was one, and an optional note of up to 300 characters to `POST /api/ask/report`. A reader can send 10 reports per UTC day. `assistant_flags` is separate. A row is written when a question is declined, when the reply is the crisis note, or when the check holds an answer back. The row stores the category (`off_topic`, `inappropriate`, `manipulation`, `crisis`, `withheld`) and the day. It does not store the question or the answer. Crisis rows leave `user_id` empty. A failed flag write is logged by error name and the reader’s reply does not change.

Recent flags:

```sql
select id, user_id, day_index, category, created_at
from public.assistant_flags
order by created_at desc
limit 50;
```

Recent reports:

```sql
select id, user_id, day_index, kind, question, answer, note, model, prompt_version, created_at
from public.assistant_reports
order by created_at desc
limit 50;
```

`npm run eval:assistant` sends the questions in `evals/assistant/cases.json` through the real screen. It needs `ANTHROPIC_API_KEY`. It prints a table of mismatches and exits non-zero if any case comes back as the wrong category. Without the key it prints one line and exits 0. It is not part of `npm test` or CI.

In development (`npm run dev`) the service role key is optional. Without it, access allows everyone locally, and the limit, cache, flags and reports live in memory. With it, signed-in readers use the database. To try the assistant with only an Anthropic key, also set `ASSISTANT_ALLOW_ANONYMOUS=1`; anonymous requests skip the access check. This flag only works when `NODE_ENV` isn’t `production`. Production never uses the allow-everyone fallback. In production, reports need the service role key. Without it, `POST /api/ask/report` returns 503.

## Reminders

A daily reminder is optional and needs an account. It arrives as a web push notification at the reader’s chosen time, in their own time zone. On iPhone and iPad it works only after the app is added to the Home Screen (iOS 16.4 or later).

1. Set up accounts and run the reminders migration.
2. Generate keys with `npx web-push generate-vapid-keys`.
3. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` locally and in Vercel.
4. In GitHub, add the variable `APP_URL` and the secret `CRON_SECRET` (the same value).

`.github/workflows/reminders.yml` runs every 15 minutes. It calls `POST /api/reminders/send` with `CRON_SECRET` as a bearer token, and skips until `CRON_SECRET` and either `REMINDERS_URL` or `APP_URL` are set. When `REMINDERS_URL` is set, it calls that complete endpoint instead. GitHub Actions does the scheduling because Vercel’s free plan runs cron jobs only once a day. GitHub may delay scheduled runs at busy times; the one-hour window below absorbs ordinary delays.

The route sends to readers whose reminder time passed within the last hour and who haven’t had a reminder that day, so running it twice sends nothing new. It sends only to `https` endpoints on known push services (listed in `supabase/functions/_shared/reminders/endpoints.ts`), uses each reader’s five most recent devices, and gives each push 10 seconds. A reader whose lookup fails is skipped and counted as `failed`. Subscriptions the push service reports as gone are removed. Signing out removes this browser’s subscription for that account. To test, run the workflow by hand from the Actions tab.

## Server on Supabase Edge Functions

The shared server code lives in `supabase/functions/_shared/`. The `ask` function serves GET status, POST questions and POST `/ask/report`, including streaming responses and CORS preflight. The `reminders-send` function accepts POST with the `CRON_SECRET` bearer token. Both use the same handlers as the Next API routes, which remain available during cutover. Edge adapters always use production rules: missing configuration disables the feature, and anonymous asking is disabled.

`supabase/functions/deno.json` pins the runtime dependencies. Run the Edge checks locally with Deno 2.x:

```bash
deno check supabase/functions/ask/index.ts supabase/functions/reminders-send/index.ts
deno test --config supabase/functions/deno.json --allow-env --allow-net=127.0.0.1 supabase/functions/tests/
```

The plan seed remains owned by `content/bible-journey-seed.json`. After editing it, run `cp content/bible-journey-seed.json supabase/functions/_shared/content/bible-journey-seed.json`; `npm test` checks the copies match.

Use the pinned CLI with `npx supabase@3.2.0` (shown as `supabase` below). From CLI 3, database commands target the local database unless given `--remote`, and hosted changes in CI need `--yes`. Do this one-time cutover in order:

1. **Repair history before any `db push` or deploy Action.** The existing project's six migrations were applied by hand. After linking the intended project with `supabase link --project-ref <ref>`, record each existing version as applied, without executing its SQL again:

   ```bash
   supabase migration repair --remote --status applied 20261113000000
   supabase migration repair --remote --status applied 20261113010000
   supabase migration repair --remote --status applied 20261114000000
   supabase migration repair --remote --status applied 20261114010000
   supabase migration repair --remote --status applied 20261114020000
   supabase migration repair --remote --status applied 20261115000000
   ```

   This repair is only for the existing database where all six already ran. A new empty project should apply the migrations normally. Future migrations must stay additive: the web app and both server adapters can be live together.

2. **Set function secrets.** Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`; do not copy those into public variables. Create a local, untracked secrets file with these names, then upload it (never commit the values):

   ```dotenv
   ANTHROPIC_API_KEY=
   ASSISTANT_ALLOWED_ORIGINS=
   CRON_SECRET=
   VAPID_PUBLIC_KEY=
   VAPID_PRIVATE_KEY=
   VAPID_SUBJECT=
   ```

   ```bash
   npx supabase@3.2.0 secrets set --env-file .env.edge.local --remote=<ref>
   ```

   `ASSISTANT_ALLOWED_ORIGINS` is a comma-separated list of exact app origins, including scheme and port where needed, with no trailing slash. Listed origins receive CORS headers; native apps and curl need no Origin header. Optional `ANTHROPIC_MODEL` and `ANTHROPIC_SCREEN_MODEL` retain the defaults documented above. Use the existing VAPID key pair: `VAPID_PUBLIC_KEY` on Edge must match the web app's `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. Use the same `CRON_SECRET` in the function and GitHub Actions.

3. **Enable deployment.** Add Actions secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`, and Actions variable `SUPABASE_PROJECT_REF`. Run the Supabase workflow manually once. On pushes to `main` touching `supabase/**` it links the project, runs `supabase db push --remote --yes`, then deploys `ask` and `reminders-send`. It skips with an explanation when any setting is missing. Migrations must remain additive; this workflow does not perform the one-time history repair.
4. **Check status from the app's browser origin.** With `<base>` equal to `https://<ref>.supabase.co/functions/v1`, run `fetch("<base>/ask").then(r => r.json()).then(console.log)` in the app's browser console. Confirm the browser accepts CORS and status reports `configured: true`; signed-out status also reports `signInRequired: true`. Then verify a signed-in, enabled reader can ask and report an answer.
5. **Switch the web client.** Set `NEXT_PUBLIC_ASSISTANT_URL=<base>` in Vercel and redeploy. Empty or unset keeps `/api/ask` and `/api/ask/report`; set uses `<base>/ask` and `<base>/ask/report`. To roll back, unset it and redeploy.
6. **Switch reminders.** Set Actions variable `REMINDERS_URL` to `<base>/reminders-send`. The schedule uses this URL when set and otherwise falls back to `${APP_URL}/api/reminders/send`. Keep the GitHub schedule; the database's atomic per-day claim prevents duplicate sends. Unset the variable to roll back.

Later work includes Expo clients, any move of scheduling to Supabase Cron, and retiring the Next routes or Vercel hosting. This change does none of those. Live deployment, model calls, database/auth access and delivery to real devices still need the owner's checks after setup.

## Settings

Settings (the slider icon beside Account) holds the daily reminder, the theme (system, light or dark), the translation used by Read online links (NIV by default), and Reset progress.

Settings are kept on the device. When signed in, they are also saved to the reader’s profile; on a device’s first sign-in, the device’s values win.

Reset asks the reader to type RESET. It clears days and verses on the device and, when signed in, on the account through `reset_progress()`. A device that was offline during a reset accepts the empty account when it reconnects, because the account carries a reset it hasn’t seen yet. A reset made offline waits and reaches the account on reconnect.

## Install and offline

The app is a progressive web app. On Android, Chrome offers Install app from its menu. On iPhone or iPad, open it in Safari, tap Share, then Add to Home Screen.

A service worker (`public/sw.js`) is registered in production builds only, so `npm run dev` never caches anything. On first load it saves every screen with its scripts, styles and fonts, so the app opens in airplane mode. Pages are network-first and fall back to the saved copy offline. `/api/*` is never cached, so the study assistant needs a connection. Each build installs a new worker version.

Icons are drawn in `public/icon.svg` and `public/icons/*.svg`. After changing them, run `node scripts/generate-icons.mjs` to redraw the PNGs.

## Deploy to Vercel

1. Import the repository in Vercel.
2. Add the environment variables from the table to the Vercel project, for Production and Preview.
3. Set the Production Branch to `main`.

Vercel builds a preview for every pull request and deploys production on every push to `main`.

Set `APP_URL` in GitHub to the production address once it exists, so reminders can reach it.

## First deploy checklist

None of these has been run against live services yet. The tests cover them with fakes only. Check each after the first deploy.

- [ ] **Migrations.** Run all six in order. In the SQL editor, `select progress_reset_at, last_reminded_on from profiles limit 1;` should run without error. `select id from assistant_flags limit 1;` and `select id from assistant_reports limit 1;` should run without error too.
- [ ] **Sign-in.** Send yourself a magic link from `/account` on the deployed site. It should land back on `/account`, signed in. If it lands elsewhere, check the Site URL and Redirect URLs.
- [ ] **Google sign-in**, if enabled. Continue with Google should come back signed in.
- [ ] **Sync across devices.** Sign in on a phone and a laptop. Tick a day on one. It should appear on the other within a few seconds, and after a reload.
- [ ] **Row-level security.** Sign in with a second account. It should see none of the first account’s progress.
- [ ] **A refused change.** If the Account screen says changes could not be synced, check the network log for the status PostgREST returned. The sync engine treats a 401 as an expired session to retry, not a refusal, so a refusal that comes back as 401 would retry without end. This path has not been seen against a live project.
- [ ] **Reset across devices.** Reset on one signed-in device while another is offline. Bring the second online. It should clear too.
- [ ] **Study assistant.** Before granting access, sign in and check that the invitation line appears without prompts or a question field. Grant access with the SQL above, reload Today and tap Historical setting. An answer should stream in. Tap it again the same day; it should come back at once from the cache. `select * from assistant_usage;` should show one row for you. Revoke access and try again; the cached answer must also be denied.
- [ ] **Reminders.** In Settings, turn on a reminder a few minutes ahead. After that time, run the Reminders workflow by hand from the Actions tab. The notification should arrive, and a second run should send nothing.
- [ ] **Install.** Add the app to the Home Screen on an iPhone and on Android. Turn on airplane mode. Today, Plan and Verses should still open.
- [ ] **Deploy.** Open a pull request and check Vercel’s own preview deploy. Merge to `main` and check the production deploy.

## How changes are made

This repo uses [gatework](docs/gatework/context.md): a brief before code, a failing test first, and evidence in the pull request. Agent rules are in `AGENTS.md`.
