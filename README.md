# Bible Journey

Bible Journey is a mobile-first web app that takes one reader through the whole Bible in a year, in the order events happened. The plan has 52 weeks, 312 reading days and 1,189 chapters. Each week also has a Sunday deep dive and a memory verse, and the app has a timeline of eras and a who’s-who of people and prophets.

Today always shows the first unread day, not a calendar date. Missing a day is never treated as failure.

The plan content lives in [`content/bible-journey-seed.json`](content/bible-journey-seed.json). It is built into the app, so there is no database seeding step. `npm test` validates it against the schema in `src/content/schema.ts` (`src/content/seed.test.ts`); run that after editing the file. The original build brief and the single-file prototype are in [`docs/reference/`](docs/reference/).

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
| `SUPABASE_SERVICE_ROLE_KEY` | Assistant limit and cache; reminders | Supabase → Project Settings → API → service_role key | Server |
| `ANTHROPIC_API_KEY` | Study assistant | [console.anthropic.com](https://console.anthropic.com) → API keys | Server |
| `ANTHROPIC_MODEL` | Study assistant (optional) | Defaults to `claude-sonnet-5-5` | Server |
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
| `VERCEL_TOKEN` | Secret | `deploy.yml` |
| `VERCEL_ORG_ID` | Secret | `deploy.yml` |
| `VERCEL_PROJECT_ID` | Secret | `deploy.yml` |

## Supabase database

Run the four migrations in [`supabase/migrations/`](supabase/migrations/) in this order. Either paste each file into the Supabase SQL editor and run it, or link the project with `supabase link --project-ref <ref>` and run `supabase db push`, which runs them in order. Each file is safe to run again.

1. `20261113000000_init.sql`: the `profiles`, `day_progress`, `verse_progress` and `push_subscriptions` tables, with row-level security and a profile for each new user. It also sets up private Realtime Broadcast channels, one per user (`progress:<user id>`), with a policy so each user can only listen to their own. The progress tables are deliberately not in the `supabase_realtime` publication, because Postgres Changes would send every user’s deletes to everyone.
2. `20261113010000_assistant.sql`: `assistant_usage`, `assistant_answers` and the functions that keep the assistant’s daily limit. Only the service role key can use them.
3. `20261114000000_reminders.sql`: `profiles.last_reminded_on`, which keeps a reader to one reminder a day.
4. `20261114010000_progress_reset.sql`: `profiles.progress_reset_at` and the `reset_progress()` function. Sync reads the reset time with every pull, so accounts need this one too.

## Accounts and sync

Signing in is optional. To turn accounts on:

1. Create a project at [supabase.com](https://supabase.com) and run the migrations above.
2. In Authentication → URL Configuration, set the Site URL to your production address. Add each address you sign in from to Redirect URLs, ending in `/account`, for example `http://localhost:3000/account` and `https://your-app.vercel.app/account`. A wildcard such as `https://*-your-team.vercel.app/account` covers preview deploys.
3. Email magic links work with no more setup. To offer Google, enable it in Authentication → Sign In / Providers and paste a client ID and secret from a Google Cloud OAuth client (type Web application). In Google Cloud, add the callback URL that Supabase shows on that page as an authorized redirect URI.
4. In Realtime → Settings, turn off “Allow public access”. The app only uses private channels.
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then restart `npm run dev` or redeploy.

On first sign-in, anything already marked on the device is merged into the account. The merge keeps everything from both, with the earliest time each day or verse was marked. Changes made offline wait on the device and send when the connection returns. A change the server refuses outright is dropped, and the Account screen says how many. Signing out keeps progress on the device. If a live update is missed, the app pulls the account again when the connection returns or the tab comes back into view.

## Study assistant

On Today, a signed-in reader can tap Historical setting, Where on the map or Who’s who, or type a question of up to 500 characters. A short answer about the day’s reading streams in from `POST /api/ask`.

In production the assistant turns on only when `ANTHROPIC_API_KEY`, both `NEXT_PUBLIC_SUPABASE_` variables and `SUPABASE_SERVICE_ROLE_KEY` are set. If any is missing, it stays off and the server logs one line naming what is missing. The server checks the reader’s Supabase access token on every question.

Each reader gets 30 questions per UTC day. The count is kept in Supabase, so the limit holds across server instances. Quick prompts count too. A cached answer is free: the same quick prompt for the same day, model and prompt version comes back without calling the model. A request cancelled before the model starts doesn’t count. Server logs carry counts and errors, never question or answer text.

In development (`npm run dev`) the service role key is optional, and the limit and cache live in memory. To try the assistant with only an Anthropic key, also set `ASSISTANT_ALLOW_ANONYMOUS=1`. It only works when `NODE_ENV` isn’t `production`.

## Reminders

A daily reminder is optional and needs an account. It arrives as a web push notification at the reader’s chosen time, in their own time zone. On iPhone and iPad it works only after the app is added to the Home Screen (iOS 16.4 or later).

1. Set up accounts and run the reminders migration.
2. Generate keys with `npx web-push generate-vapid-keys`.
3. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` locally and in Vercel.
4. In GitHub, add the variable `APP_URL` and the secret `CRON_SECRET` (the same value).

`.github/workflows/reminders.yml` runs every 15 minutes. It calls `POST /api/reminders/send` with `CRON_SECRET` as a bearer token, and skips quietly until `APP_URL` and `CRON_SECRET` are both set. GitHub Actions does the scheduling because Vercel’s free plan runs cron jobs only once a day. GitHub may delay scheduled runs at busy times; the one-hour window below absorbs ordinary delays.

The route sends to readers whose reminder time passed within the last hour and who haven’t had a reminder that day, so running it twice sends nothing new. It sends only to `https` endpoints on known push services (listed in `src/reminders/endpoints.ts`), uses each reader’s five most recent devices, and gives each push 10 seconds. A reader whose lookup fails is skipped and counted as `failed`. Subscriptions the push service reports as gone are removed. Signing out removes this browser’s subscription for that account. To test, run the workflow by hand from the Actions tab.

## Settings

Settings (the slider icon beside Account) holds the daily reminder, the theme (system, light or dark), the translation used by Read online links (NIV by default), and Reset progress.

Settings are kept on the device. When signed in, they are also saved to the reader’s profile; on a device’s first sign-in, the device’s values win.

Reset asks the reader to type RESET. It clears days and verses on the device and, when signed in, on the account through `reset_progress()`. A device that was offline during a reset accepts the empty account when it reconnects, because the account carries a reset it hasn’t seen yet. A reset made offline waits and reaches the account on reconnect.

## Install and offline

The app is a progressive web app. On Android, Chrome offers Install app from its menu. On iPhone or iPad, open it in Safari, tap Share, then Add to Home Screen.

A service worker (`public/sw.js`) is registered in production builds only, so `npm run dev` never caches anything. On first load it saves every screen with its scripts, styles and fonts, so the app opens in airplane mode. Pages are network-first and fall back to the saved copy offline. `/api/*` is never cached, so the study assistant needs a connection. Each build installs a new worker version.

Icons are drawn in `public/icon.svg` and `public/icons/*.svg`. After changing them, run `node scripts/generate-icons.mjs` to redraw the PNGs.

## Deploy to Vercel

There are two ways. Pick one.

**Through GitHub Actions.** `.github/workflows/deploy.yml` deploys a preview for each pull request and production on every push to `main`. It skips itself until its three secrets are set.

1. Create a Vercel project for the repository. Turn off Vercel’s own Git deployments for it, so each commit isn’t deployed twice.
2. Create a token at vercel.com → Account Settings → Tokens. Save it as the `VERCEL_TOKEN` secret.
3. Run `npx vercel link` in a checkout. Copy `orgId` and `projectId` from `.vercel/project.json` into the `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` secrets.
4. Add the environment variables from the table to the Vercel project, for Production and Preview.

**By connecting the repository.** Import the repository in Vercel and add the environment variables. Leave the three Vercel secrets unset. Vercel then builds every push itself, and the Actions workflow skips.

Either way, set `APP_URL` in GitHub to the production address once it exists, so reminders can reach it.

## First deploy checklist

None of these has been run against live services yet. The tests cover them with fakes only. Check each after the first deploy.

- [ ] **Migrations.** Run all four in order. In the SQL editor, `select progress_reset_at, last_reminded_on from profiles limit 1;` should run without error.
- [ ] **Sign-in.** Send yourself a magic link from `/account` on the deployed site. It should land back on `/account`, signed in. If it lands elsewhere, check the Site URL and Redirect URLs.
- [ ] **Google sign-in**, if enabled. Continue with Google should come back signed in.
- [ ] **Sync across devices.** Sign in on a phone and a laptop. Tick a day on one. It should appear on the other within a few seconds, and after a reload.
- [ ] **Row-level security.** Sign in with a second account. It should see none of the first account’s progress.
- [ ] **A refused change.** If the Account screen says changes could not be synced, check the network log for the status PostgREST returned. The sync engine treats a 401 as an expired session to retry, not a refusal, so a refusal that comes back as 401 would retry without end. This path has not been seen against a live project.
- [ ] **Reset across devices.** Reset on one signed-in device while another is offline. Bring the second online. It should clear too.
- [ ] **Study assistant.** Signed in, tap Historical setting. An answer should stream in. Tap it again the same day; it should come back at once from the cache. `select * from assistant_usage;` should show one row for you.
- [ ] **Reminders.** In Settings, turn on a reminder a few minutes ahead. After that time, run the Reminders workflow by hand from the Actions tab. The notification should arrive, and a second run should send nothing.
- [ ] **Install.** Add the app to the Home Screen on an iPhone and on Android. Turn on airplane mode. Today, Plan and Verses should still open.
- [ ] **Deploy workflow.** Open a pull request and check that the preview deploys. Merge to `main` and check that production deploys.

## How changes are made

This repo uses [gatework](docs/gatework/context.md): a brief before code, a failing test first, and evidence in the pull request. Agent rules are in `AGENTS.md`.
