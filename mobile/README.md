# Bible Journey

The native app. Today is one page of the tear-off pad. Plan is the year. Verses is this week's verse, practice, and the list of 52. Notes gathers what was written on each day.

## Run

From this directory:

```bash
npx expo start
```

Press `i` for the iOS Simulator, or open the project in Expo Go on a phone.

## Checks

```bash
npm run typecheck
npm run lint
npm test
```

## Sign in

The app uses the same Supabase accounts as the web app. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. When either one is missing, the app stays signed out and sign-in says it isn’t set up on this copy. `.env` stays on this machine.

## Design

The system is `DESIGN.md` at the repo root. The approved screens are `docs/reference/design/native/mocks.html`, with the captures beside that file.
