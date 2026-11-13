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
2. Run the schema. Either paste [`supabase/migrations/20261113000000_init.sql`](supabase/migrations/20261113000000_init.sql) into the SQL editor and run it, or with the Supabase CLI run `supabase link --project-ref <ref>` and then `supabase db push`. It creates `profiles`, `day_progress`, `verse_progress` and `push_subscriptions` with row-level security and a profile for each new user. Changes to the two progress tables go out as Realtime Broadcast on a private channel per user (`progress:<user id>`), with a policy on `realtime.messages` so each user can only listen to their own. The tables are deliberately not in the `supabase_realtime` publication, because Postgres Changes would send every user’s deletes to everyone. It is safe to run again.
3. In Authentication → URL Configuration, set the Site URL to your production address and add each address you sign in from to Redirect URLs, ending in `/account`: for example `http://localhost:3000/account` and `https://your-app.vercel.app/account`. A wildcard such as `https://*-your-team.vercel.app/account` covers preview deploys.
4. To offer Google: in Authentication → Sign In / Providers, enable Google and paste a client ID and secret from a Google Cloud OAuth client (type Web application). In Google Cloud, add the callback URL Supabase shows on that page as an authorized redirect URI. Email magic links work without this step.
5. In Realtime → Settings, turn off “Allow public access” so channels have to be private and go through the `realtime.messages` policies. The app only uses private channels, so nothing else changes.
6. Copy the Project URL and the anon public key from Project Settings → API into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and into the Vercel project’s environment variables. Restart `npm run dev` or redeploy; the values are built into the page.

On first sign-in, anything already marked on the device is merged into the account: the union of both, keeping the earliest time each day or verse was marked. Changes made offline wait on the device and send when the connection returns; a change the server refuses outright is dropped and counted on the Account screen. Signing out keeps progress on the device. If a live update is missed, the app pulls the account again when the connection returns or the tab comes back into view.

## Study assistant

On Today, a signed-in reader can tap Historical setting, Where on the map or Who’s who, or type a question of up to 500 characters, and a short answer about the day’s reading streams in from `POST /api/ask`. Without the variables below, Today says the assistant isn’t set up and everything else works.

- `ANTHROPIC_API_KEY`: turns the assistant on. Server only; never prefix it with `NEXT_PUBLIC_`.
- `ANTHROPIC_MODEL`: optional. Defaults to `claude-sonnet-5-5` (set in `src/assistant/config.ts`).
- `SUPABASE_SERVICE_ROLE_KEY`: keeps the daily limit (30 questions per reader per UTC day) and the quick-prompt answer cache in Supabase. Without it both live in the server’s memory, which resets on every deploy or cold start. Run [`supabase/migrations/20261113010000_assistant.sql`](supabase/migrations/20261113010000_assistant.sql) the same way as the first migration; it adds `assistant_usage`, `assistant_answers` and the `assistant_take_question` function, readable only with the service role key.

The assistant needs accounts (the Supabase URL and anon key above): the server checks the reader’s access token on every question. Quick-prompt answers are cached per day and prompt, so a repeat is instant and doesn’t count toward the limit. Server logs carry counts and errors, never question text.

To try it locally with only an Anthropic key, set `ASSISTANT_ALLOW_ANONYMOUS=1` in `.env.local` and run `npm run dev`. The route then accepts signed-out requests with an in-memory limit. It only works when `NODE_ENV` isn’t `production`, so it never applies to `npm run build && npm start` or a deploy.

## Deploy

`.github/workflows/deploy.yml` deploys a Vercel preview for each pull request and production on a push to `main`. It skips itself until the repository has these secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## How changes are made

This repo uses [gatework](docs/gatework/context.md): a brief before code, a failing test first, evidence in the pull request. Agent rules are in `AGENTS.md`.
