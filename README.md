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

## Deploy

`.github/workflows/deploy.yml` deploys a Vercel preview for each pull request and production on a push to `main`. It skips itself until the repository has these secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

## How changes are made

This repo uses [gatework](docs/gatework/context.md): a brief before code, a failing test first, evidence in the pull request. Agent rules are in `AGENTS.md`.
