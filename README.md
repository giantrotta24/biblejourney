# Bible Journey

A mobile-first web app that guides one reader through the whole Bible in a year, in chronological order, with the history, geography and people alongside and 52 verses to memorize.

The plan content lives in [`content/bible-journey-seed.json`](content/bible-journey-seed.json). The original build brief and the single-file prototype are in [`docs/reference/`](docs/reference/).

## Run it locally

Needs Node 22.18 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. No environment variables are needed: signed out, progress is saved on the device.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

CI runs all four on every pull request.

## Environment variables

Copy `.env.example` to `.env.local`. Each group turns on one feature (accounts and sync, the study assistant, reminders) and the app works without any of them.

## Accounts and sync

Signing in is optional. Without the Supabase variables the Account screen says accounts aren’t set up, and progress stays on the device. To turn accounts on:

1. Create a project at [supabase.com](https://supabase.com).
2. Run the schema. Either paste [`supabase/migrations/20261113000000_init.sql`](supabase/migrations/20261113000000_init.sql) into the SQL editor and run it, or with the Supabase CLI run `supabase link --project-ref <ref>` and then `supabase db push`. It creates `profiles`, `day_progress`, `verse_progress` and `push_subscriptions` with row-level security, a profile for each new user, and realtime on the two progress tables. It is safe to run again.
3. In Authentication → URL Configuration, set the Site URL to your production address and add each address you sign in from to Redirect URLs, ending in `/account`: for example `http://localhost:3000/account` and `https://your-app.vercel.app/account`. A wildcard such as `https://*-your-team.vercel.app/account` covers preview deploys.
4. To offer Google: in Authentication → Sign In / Providers, enable Google and paste a client ID and secret from a Google Cloud OAuth client (type Web application). In Google Cloud, add the callback URL Supabase shows on that page as an authorized redirect URI. Email magic links work without this step.
5. Copy the Project URL and the anon public key from Project Settings → API into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and into the Vercel project’s environment variables. Restart `npm run dev` or redeploy; the values are built into the page.

On first sign-in, anything already marked on the device is merged into the account: the union of both, keeping the earliest time each day or verse was marked. Changes made offline wait on the device and send when the connection returns. Signing out keeps progress on the device.

## Install and offline

The app is a progressive web app. On Android, Chrome offers Install app from its menu. On iPhone or iPad, open it in Safari, tap Share, then Add to Home Screen.

A service worker (`public/sw.js`) is registered in production builds only, so `npm run dev` never caches anything. On first load it saves Today, Plan, Timeline, Verses, Who’s who, Account and Settings with their scripts, styles and fonts, so they open in airplane mode. Pages are network-first, falling back to the saved copy offline; `/api/*` is never cached, so the study assistant needs a connection. Each build registers the worker under a new version, which replaces the saved copy and clears the old one the next time the app is opened online. Icons are drawn in `public/icon.svg` and `public/icons/*.svg`; after changing them run `node scripts/generate-icons.mjs` to redraw the PNGs.

## Reminders

A daily reminder is optional, needs an account, and arrives as a web push notification at the reader’s chosen time in their own time zone. On iPhone it works only after the app is added to the Home Screen (iOS 16.4 or later). Without the variables below the setting says reminders aren’t set up and nothing else changes.

1. Set up accounts first (above), then run [`supabase/migrations/20261114000000_reminders.sql`](supabase/migrations/20261114000000_reminders.sql) the same way. It adds `profiles.last_reminded_on`, which keeps a reader to one reminder a day.
2. Generate a key pair with `npx web-push generate-vapid-keys`.
3. Set these in `.env.local` and in the Vercel project: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (the public key), `VAPID_PRIVATE_KEY` (the private key), `VAPID_SUBJECT` (a `mailto:` address push services can contact), `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API; the send route uses it to read every reader’s subscriptions), and `CRON_SECRET` (any long random string, for example from `openssl rand -hex 32`). Only the `NEXT_PUBLIC_` key reaches the browser.
4. In the GitHub repository, add a variable `APP_URL` (the production address, such as `https://your-app.vercel.app`) under Settings → Secrets and variables → Actions → Variables, and a secret `CRON_SECRET` with the same value as above.

`.github/workflows/reminders.yml` runs every 15 minutes and calls `POST /api/reminders/send` with the secret as a bearer token; it skips quietly until both are set. The route sends to readers whose reminder time passed within the last hour in their own time zone and who haven’t had one that day, then drops subscriptions the push service reports gone. Running it twice sends nothing new. GitHub Actions does the scheduling because Vercel’s free plan runs cron jobs only once a day, which can’t follow each reader’s time zone. GitHub may delay scheduled runs at busy times; the one-hour window absorbs ordinary delays. Run the workflow by hand from the Actions tab to test it.

## Settings

Settings (the slider icon beside Account) holds the daily reminder, the theme (system, light or dark, applied before the page paints), the translation used by Read online links (NIV by default), and Reset progress, which asks the reader to type RESET. Settings are kept on the device; when signed in they are also saved to the reader’s profile, with the device’s values winning on its first sign-in. Reset clears days and verses on the device and, when signed in, on the account.

## Deploy

`.github/workflows/deploy.yml` deploys a Vercel preview for each pull request and production on a push to `main`. It skips itself until the repository has these secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## How changes are made

This repo uses [gatework](docs/gatework/context.md): a brief before code, a failing test first, evidence in the pull request. Agent rules are in `AGENTS.md`.
