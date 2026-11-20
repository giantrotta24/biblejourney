# Bible Journey

The native app. Today is one page of the tear-off pad. Plan is the year. Verses is this week's verse, practice, and the list of 52. Notes gathers what was written on each day.

## Run

From this directory:

```bash
npx expo start
```

Press `i` for the iOS Simulator, or open the project in Expo Go on a phone. Press `s` to switch to a development build. Apple sign-in and real notifications need that build.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run config
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

## Ship a test build

From this directory. These are the steps that need your accounts.

Deploy the notes migration before a build that syncs, and `account-delete` before a build that shows Delete account. The Sign in section above says what each one does.

1. Join the Apple Developer Program.
2. `npm i -g eas-cli`, then `eas login`.
3. `eas init`. That writes the Expo owner and project id into `app.json`.
4. Create `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_ASSISTANT_URL` on the `preview` and `production` environments with `eas env:set`. The assistant URL is the hosted ask function, `https://<project>.supabase.co/functions/v1/ask`.
5. In Supabase Auth, add the redirect URL `biblejourney://auth-callback`. Turn on Apple, with the bundle id `dev.giantrotta.biblejourney` as the client id, and turn on Google.
6. Replace the account placeholders in `eas.json`: `appleId`, `ascAppId`, `appleTeamId`, and `serviceAccountKeyPath`. Then `eas build -p ios --profile production` and `eas submit -p ios`. Add testers in App Store Connect.
7. For Android, open a Google Play developer account. `eas build -p android --profile production` builds the app bundle, and the production submit profile sends it to the internal testing track.

## Design

The system is `DESIGN.md` at the repo root. The approved screens are `docs/reference/design/native/mocks.html`, with the captures beside that file.
