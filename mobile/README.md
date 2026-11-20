# Bible Journey

The native app. Today is one page of the tear-off pad. Plan is the year. Verses is this week's verse, practice, and the list of 52. Notes gathers what was written on each day.

## Run

From this directory:

```bash
npx expo start
```

Because `expo-dev-client` is installed, `npx expo start` serves a development build, which Apple sign-in and real notifications need. Make one for the iOS Simulator first with `npx eas-cli@latest build -p ios --profile development` (or `npx expo run:ios`) and install it; it reads `.env` through Metro, as Expo Go does. Then press `i`. To use Expo Go instead, run `npx expo start --go`, or press `s` to switch.

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

From this directory. These are the steps that need your accounts. Run EAS as `npx eas-cli@latest <command>`.

1. Deploy the backend the build talks to: the migrations with `npx supabase@3.2.0 db push --remote`, then `npx supabase@3.2.0 functions deploy ask reminders-send account-delete --no-verify-jwt`. The root README's Supabase sections cover linking, secrets and the one-time history repair. The Deploy Supabase workflow runs the same two commands on pushes to `main`. Without the notes migration, notes don't sync; without `account-delete`, Delete account fails.
2. Join the Apple Developer Program.
3. `npx eas-cli@latest login`, then `npx eas-cli@latest init`. That writes the Expo owner and project id into `app.json`.
4. Create `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_ASSISTANT_URL` on the `preview` and `production` environments with `npx eas-cli@latest env:set`, using the same values as `.env`. The assistant URL is the hosted ask function, `https://<project>.supabase.co/functions/v1/ask`.
5. Set up sign in as the Sign in section above says. For Google, use the OAuth client from the root README's Google steps.
6. In App Store Connect, create an app with the bundle id `dev.giantrotta.biblejourney`. In `eas.json`, replace `ascAppId` with that app's Apple ID (under General Information) and `appleTeamId` with your team id.
7. `npx eas-cli@latest build -p ios --profile production`, then `npx eas-cli@latest submit -p ios --profile production`. Add testers in TestFlight.
8. For Android, open a Google Play developer account and create an app with the package `dev.giantrotta.biblejourney`. Create a Google service account key and upload it with `npx eas-cli@latest credentials -p android` (production profile, Google Service Account). Keep the JSON key file out of this repo.
9. `npx eas-cli@latest build -p android --profile production` builds the app bundle, and `npx eas-cli@latest submit -p android --profile production` sends it to the internal testing track.

## Design

The system is `DESIGN.md` at the repo root. The approved screens are `docs/reference/design/native/mocks.html`, with the captures beside that file.
