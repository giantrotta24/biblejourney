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

Deploy `supabase/migrations/20261120000000_notes.sql` before a build that syncs. Without that table, note writes are refused.

Deploy `account-delete` before a build that shows Delete account. Without that function, delete fails and the account stays.

Set `EXPO_PUBLIC_ASSISTANT_URL` to the ask function, `https://<project>.supabase.co/functions/v1/ask`, to show Ask about this reading on the day’s page. A report is sent to that same address with `/report` on the end. Leave the variable blank and the link stays hidden. The app does not hold an Anthropic key.

In the Supabase Auth settings, allow these redirect URLs:

- `biblejourney://auth-callback`
- `exp://<host>:<port>/--/auth-callback` for Expo Go

Turn on the Apple and Google providers. Apple uses the iOS bundle id (`dev.giantrotta.biblejourney`) as a client id. Google uses the OAuth client.

## Design

The system is `DESIGN.md` at the repo root. The approved screens are `docs/reference/design/native/mocks.html`, with the captures beside that file.
