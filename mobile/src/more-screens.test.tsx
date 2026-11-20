import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, Appearance, StyleSheet, Text } from 'react-native';

import { fakeAuth, resetFakeAuth } from '@/account/fake-supabase';
import { WelcomeGate, WELCOMED_KEY } from '@/account/welcome';
import { ReadingProviders } from '@/providers';
import AccountRoute from '@/app/(tabs)/more/account';
import MoreScreen from '@/app/(tabs)/more/index';
import SettingsRoute from '@/app/(tabs)/more/settings';
import TimelineRoute from '@/app/(tabs)/more/timeline';
import TranslationRoute from '@/app/(tabs)/more/translation';
import WhosWhoRoute from '@/app/(tabs)/more/whos-who';
import { supabase } from '@/account/supabase';
import { DELETE_FAILED, DELETE_OFFLINE } from '@/account/delete';
import { NOTES_KEY, NOTES_UNREADABLE_KEY } from '@/notes/store';
import { PROGRESS_KEY, PROGRESS_V2_KEY, PROGRESS_V2_UNREADABLE_KEY } from '@/progress/store';
import { changeSettings, loadSettings, resetSettingsForTests } from '@/settings/client';
import { createFakeServer } from '@/sync/fake-remote';
import { SYNC_QUEUE_KEY } from '@/sync/queue';
import { light, useColors } from '@/theme/colors';
import { VERSES_KEY, VERSES_UNREADABLE_KEY } from '@/verses/store';

/* eslint-disable @typescript-eslint/no-require-imports -- the mock factory cannot close over an import */
jest.mock('@/account/supabase', () => require('@/account/fake-supabase'));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), dismissAll: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const note = {
  version: 1,
  rows: [{ day_index: 1, body: 'Kept', updated_at: '2026-11-18T12:00:00.000Z' }],
};
const day = { version: 1, rows: [{ day_index: 4, completed_at: '2026-11-18T12:00:00.000Z' }] };
const verse = { version: 1, rows: [{ week: 3, learned_at: '2026-11-18T12:00:00.000Z' }] };

async function confirm(title: string, label: string) {
  const call = jest.mocked(Alert.alert).mock.calls.filter((item) => item[0] === title).at(-1);
  const buttons = call?.[2] as { text: string; onPress?: () => void | Promise<void> }[] | undefined;
  const button = buttons?.find((item) => item.text === label);
  if (!button?.onPress) throw new Error(`No ${label} button on ${title}`);
  await act(async () => {
    await button.onPress?.();
  });
}

function Swatch() {
  const colors = useColors();
  return <Text testID="swatch">{colors.paper}</Text>;
}

describe('More reference and settings', () => {
  beforeEach(async () => {
    resetSettingsForTests();
    resetFakeAuth();
    jest.mocked(router.push).mockClear();
    jest.mocked(router.navigate).mockClear();
    jest.mocked(router.dismissAll).mockClear();
    jest.spyOn(Alert, 'alert').mockClear().mockImplementation(() => {});
    jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    await AsyncStorage.clear();
  });

  it('opens Timeline, Who’s who, and Settings from More, and has no subscription', async () => {
    await render(
      <ReadingProviders>
        <MoreScreen />
      </ReadingProviders>,
    );
    await screen.findByRole('button', { name: 'Account, Not signed in' });
    expect(screen.queryByText('Subscription')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /Timeline, The 11 eras/ }));
    expect(router.push).toHaveBeenCalledWith('/more/timeline');
    await fireEvent.press(screen.getByRole('button', { name: /Who’s who, Peoples and prophets/ }));
    expect(router.push).toHaveBeenCalledWith('/more/whos-who');
    await fireEvent.press(screen.getByRole('button', { name: /Settings, Reminder, appearance, translation/ }));
    expect(router.push).toHaveBeenCalledWith('/more/settings');
  });

  it('lists the eras and marks the current one in blue', async () => {
    await render(
      <ReadingProviders>
        <TimelineRoute />
      </ReadingProviders>,
    );
    expect(await screen.findByText('The story in time')).toBeOnTheScreen();
    expect(screen.getByText('Creation and the patriarchs')).toBeOnTheScreen();
    expect(screen.getByText('The early church')).toBeOnTheScreen();
    expect(screen.getByText(/From the garden to Abraham’s call/)).toBeOnTheScreen();
    expect(screen.getByText(/Mesopotamian city-states · Weeks 1–5/)).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByText('Creation and the patriarchs').props.style).color).toBe(light.blueInk);
    expect(StyleSheet.flatten(screen.getByText('Egypt and the Exodus').props.style).color).toBe(light.ink);

    const egypt = screen.getByRole('button', { name: /Egypt and the Exodus/ });
    expect(egypt.props.accessibilityHint).toBe('Opens week 5 in Plan');
    await fireEvent.press(egypt);
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/plan', params: { week: '5' } });
  });

  it('lists peoples and prophets from the plan', async () => {
    await render(
      <ReadingProviders>
        <WhosWhoRoute />
      </ReadingProviders>,
    );
    expect(await screen.findByText('The peoples')).toBeOnTheScreen();
    expect(screen.getByText('Hebrews')).toBeOnTheScreen();
    expect(screen.getByText(/Abraham’s descendants/)).toBeOnTheScreen();
    expect(screen.getByText('The prophets in their time')).toBeOnTheScreen();
    expect(screen.getByText('Elijah, Elisha')).toBeOnTheScreen();
    expect(screen.getByText(/Reject Baal worship/)).toBeOnTheScreen();
    expect(screen.getByText(/Spoke to Nineveh/)).toBeOnTheScreen();
    expect(screen.getByText(/About Nineveh/)).toBeOnTheScreen();
  });

  it('stores appearance, applies it, and keeps the Bible Gateway translation', async () => {
    await render(
      <ReadingProviders>
        <SettingsRoute />
        <Swatch />
      </ReadingProviders>,
    );
    expect(await screen.findByRole('button', { name: 'Match the phone' })).toBeSelected();
    expect(StyleSheet.flatten(screen.getByRole('button', { name: 'Match the phone' }).props.style).borderTopWidth ?? 0).toBe(0);
    expect(StyleSheet.flatten(screen.getByRole('button', { name: 'Light' }).props.style).borderTopWidth).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Dark' }));
    expect(screen.getByRole('button', { name: 'Dark' })).toBeSelected();
    expect(Appearance.setColorScheme).toHaveBeenCalledWith('dark');
    expect(screen.getByTestId('swatch')).toHaveTextContent('#171715');
    expect(JSON.parse((await AsyncStorage.getItem('biblejourney.settings.v1')) ?? '{}')).toMatchObject({ theme: 'dark' });

    await fireEvent.press(screen.getByRole('button', { name: 'Match the phone' }));
    expect(Appearance.setColorScheme).toHaveBeenCalledWith('unspecified');
    expect(screen.getByTestId('swatch')).toHaveTextContent(light.paper);

    await screen.unmount();
    changeSettings({ linkTranslation: 'KJV' });
    await render(
      <ReadingProviders>
        <TranslationRoute />
      </ReadingProviders>,
    );
    expect(await screen.findByRole('button', { name: 'King James Version (KJV)' })).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'English Standard Version (ESV)' }));
    expect(screen.getByRole('button', { name: 'English Standard Version (ESV)' })).toBeSelected();
    const stored = JSON.parse((await AsyncStorage.getItem('biblejourney.settings.v1')) ?? '{}') as { linkTranslation?: string };
    expect(stored.linkTranslation).toBe('ESV');
    await loadSettings();
    expect(JSON.parse((await AsyncStorage.getItem('biblejourney.settings.v1')) ?? '{}').linkTranslation).toBe('ESV');
  });

  it('resets progress and known verses, keeps notes, and queues the reset when signed in', async () => {
    fakeAuth.session = { access_token: 'token', user: { id: 'user-1', email: 'reader@example.com' } };
    await AsyncStorage.setItem(PROGRESS_V2_KEY, JSON.stringify(day));
    await AsyncStorage.setItem(VERSES_KEY, JSON.stringify(verse));
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(note));
    const server = createFakeServer();
    await render(
      <ReadingProviders remoteFor={(userId) => server.device(userId)}>
        <SettingsRoute />
      </ReadingProviders>,
    );
    await screen.findByRole('button', { name: 'Reset progress…' });
    await fireEvent.press(screen.getByRole('button', { name: 'Reset progress…' }));
    expect(Alert.alert).toHaveBeenCalledWith('Reset your progress?', expect.stringMatching(/notes are kept/i), expect.any(Array));
    await confirm('Reset your progress?', 'Reset');
    await waitFor(() => expect(server.resetAt('user-1')).not.toBeNull());
    await waitFor(async () => {
      const progress = JSON.parse((await AsyncStorage.getItem(PROGRESS_V2_KEY)) ?? '{}') as { rows?: unknown[] };
      const verses = JSON.parse((await AsyncStorage.getItem(VERSES_KEY)) ?? '{}') as { rows?: unknown[] };
      expect(progress.rows).toEqual([]);
      expect(verses.rows).toEqual([]);
    });
    expect(JSON.parse((await AsyncStorage.getItem(NOTES_KEY)) ?? '{}').rows[0].body).toBe('Kept');
  });

  it('resets on the phone without a queue when signed out', async () => {
    await AsyncStorage.setItem(PROGRESS_V2_KEY, JSON.stringify(day));
    await AsyncStorage.setItem(VERSES_KEY, JSON.stringify(verse));
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(note));
    await render(
      <ReadingProviders>
        <SettingsRoute />
      </ReadingProviders>,
    );
    await screen.findByRole('button', { name: 'Reset progress…' });
    await fireEvent.press(screen.getByRole('button', { name: 'Reset progress…' }));
    await confirm('Reset your progress?', 'Reset');
    await waitFor(async () => {
      const progress = JSON.parse((await AsyncStorage.getItem(PROGRESS_V2_KEY)) ?? '{}') as { rows?: unknown[] };
      expect(progress.rows).toEqual([]);
    });
    const queue = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    expect(queue ?? '').not.toContain('mark-reset');
    expect(JSON.parse((await AsyncStorage.getItem(NOTES_KEY)) ?? '{}').rows[0].body).toBe('Kept');
  });
});

describe('Delete account', () => {
  beforeEach(async () => {
    resetSettingsForTests();
    resetFakeAuth();
    jest.mocked(router.navigate).mockClear();
    jest.mocked(router.dismissAll).mockClear();
    jest.spyOn(Alert, 'alert').mockClear().mockImplementation(() => {});
    await AsyncStorage.clear();
    fakeAuth.session = { access_token: 'token', user: { id: 'user-1', email: 'reader@example.com' } };
    await AsyncStorage.setItem(PROGRESS_V2_KEY, JSON.stringify(day));
    await AsyncStorage.setItem(VERSES_KEY, JSON.stringify(verse));
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(note));
    await AsyncStorage.setItem(WELCOMED_KEY, '1');
    await AsyncStorage.setItem(PROGRESS_KEY, '{"version":1,"days":[1]}');
    await AsyncStorage.setItem(PROGRESS_V2_UNREADABLE_KEY, '{');
    await AsyncStorage.setItem(VERSES_UNREADABLE_KEY, '{');
    await AsyncStorage.setItem(NOTES_UNREADABLE_KEY, '{');
  });

  async function renderAccount() {
    await render(
      <ReadingProviders>
        <WelcomeGate onAccount={() => {}}>
          <Text>Today</Text>
        </WelcomeGate>
        <AccountRoute />
      </ReadingProviders>,
    );
    expect(await screen.findByText('reader@example.com')).toBeOnTheScreen();
  }

  it('asks, and on success clears the phone and shows the welcome', async () => {
    const fetchMock = jest.fn(async (_url: string, _init?: { headers: { Authorization: string } }) =>
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    jest.spyOn(globalThis as { fetch: typeof fetch }, 'fetch').mockImplementation(fetchMock as typeof fetch);
    await renderAccount();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account…' }));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete your account?',
      'This deletes your account and clears your progress and notes on this phone. It can’t be undone.',
      expect.any(Array),
    );
    await confirm('Delete your account?', 'Delete');
    expect(await screen.findByText('Read the whole Bible in a year, in the order it happened.')).toBeOnTheScreen();
    expect(router.dismissAll).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith('/');
    expect(fakeAuth.session).toBeNull();
    const progress = JSON.parse((await AsyncStorage.getItem(PROGRESS_V2_KEY)) ?? '{}') as { rows?: unknown[] };
    const verses = JSON.parse((await AsyncStorage.getItem(VERSES_KEY)) ?? '{}') as { rows?: unknown[] };
    const notes = JSON.parse((await AsyncStorage.getItem(NOTES_KEY)) ?? '{}') as { rows?: unknown[] };
    expect(progress.rows).toEqual([]);
    expect(verses.rows).toEqual([]);
    expect(notes.rows).toEqual([]);
    expect(await AsyncStorage.getItem(WELCOMED_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(PROGRESS_V2_UNREADABLE_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(VERSES_UNREADABLE_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(NOTES_UNREADABLE_KEY)).toBeNull();
    const queued = JSON.parse((await AsyncStorage.getItem(SYNC_QUEUE_KEY)) ?? '{"ops":[],"linkedUser":null}') as {
      ops: unknown[];
      linkedUser: string | null;
    };
    expect(queued.ops).toEqual([]);
    expect(queued.linkedUser).toBeNull();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toContain('/functions/v1/account-delete');
    expect(init?.headers.Authorization).toBe('Bearer token');
  });

  it('leaves the phone alone when the delete fails', async () => {
    jest.spyOn(globalThis as { fetch: typeof fetch }, 'fetch').mockImplementation((async () =>
      new Response(JSON.stringify({ error: 'upstream' }), { status: 502 })) as typeof fetch);
    await renderAccount();
    const progressBefore = await AsyncStorage.getItem(PROGRESS_V2_KEY);
    const notesBefore = await AsyncStorage.getItem(NOTES_KEY);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account…' }));
    await confirm('Delete your account?', 'Delete');
    const failure = await screen.findByText(DELETE_FAILED);
    expect(failure).toBeOnTheScreen();
    expect(StyleSheet.flatten(failure.props.style).color).toBe(light.danger);
    expect(screen.getByText('reader@example.com')).toBeOnTheScreen();
    expect(screen.queryByText(/Read the whole Bible/)).toBeNull();
    expect(await AsyncStorage.getItem(PROGRESS_V2_KEY)).toBe(progressBefore);
    expect(await AsyncStorage.getItem(NOTES_KEY)).toBe(notesBefore);
    expect(await AsyncStorage.getItem(WELCOMED_KEY)).toBe('1');
    expect(fakeAuth.session?.user.id).toBe('user-1');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('clears the phone when a lost delete is tried again', async () => {
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('lost'))
      .mockResolvedValueOnce(new Response('not-json', { status: 200 }));
    jest.spyOn(globalThis as { fetch: typeof fetch }, 'fetch').mockImplementation(fetchMock as typeof fetch);
    await renderAccount();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account…' }));
    await confirm('Delete your account?', 'Delete');
    expect(await screen.findByText(DELETE_OFFLINE)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account…' }));
    await confirm('Delete your account?', 'Delete');
    expect(await screen.findByText('Read the whole Bible in a year, in the order it happened.')).toBeOnTheScreen();
    const progress = JSON.parse((await AsyncStorage.getItem(PROGRESS_V2_KEY)) ?? '{}') as { rows?: unknown[] };
    expect(progress.rows).toEqual([]);
    expect(await AsyncStorage.getItem(WELCOMED_KEY)).toBeNull();
  });

  it('shows the welcome again when delete follows Start in the same run', async () => {
    fakeAuth.session = null;
    await AsyncStorage.clear();
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    jest.spyOn(globalThis as { fetch: typeof fetch }, 'fetch').mockImplementation(fetchMock as typeof fetch);
    await render(
      <ReadingProviders>
        <WelcomeGate onAccount={() => {}}>
          <Text>Today</Text>
        </WelcomeGate>
        <AccountRoute />
      </ReadingProviders>,
    );
    expect(await screen.findByText('Read the whole Bible in a year, in the order it happened.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start with day 1' }));
    expect(screen.getByText('Today')).toBeOnTheScreen();
    const client = supabase;
    if (!client) throw new Error('supabase');
    await act(async () => {
      await client.auth.verifyOtp({ email: 'reader@example.com', token: '123456', type: 'email' });
    });
    expect(await screen.findByText('reader@example.com')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account…' }));
    await confirm('Delete your account?', 'Delete');
    expect(await screen.findByText('Read the whole Bible in a year, in the order it happened.')).toBeOnTheScreen();
  });

  it('removes a live notes key the store has not loaded', async () => {
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    jest.spyOn(globalThis as { fetch: typeof fetch }, 'fetch').mockImplementation(fetchMock as typeof fetch);
    const notesStorage = {
      async getItem() {
        throw new Error('read');
      },
      async setItem() {},
    };
    await render(
      <ReadingProviders notesStorage={notesStorage}>
        <AccountRoute />
      </ReadingProviders>,
    );
    expect(await screen.findByText('reader@example.com')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account…' }));
    await confirm('Delete your account?', 'Delete');
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(NOTES_KEY)).toBeNull();
    });
    expect(await AsyncStorage.getItem(PROGRESS_V2_UNREADABLE_KEY)).toBeNull();
  });
});
