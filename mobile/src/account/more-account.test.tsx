import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AppState, Pressable, Text } from 'react-native';

import { ReadingProviders } from '@/providers';
import { useProgress } from '@/progress/context';
import { OFFLINE_LINE, SYNCED_LINE, SYNCING_LINE } from '@/sync/copy';
import { createFakeServer, type FakeDevice } from '@/sync/fake-remote';
import AccountRoute from '@/app/(tabs)/more/account';
import MoreScreen from '@/app/(tabs)/more/index';
import { NOTES_KEY } from '@/notes/store';
import { PROGRESS_KEY } from '@/progress/store';

import { fakeAuth, resetFakeAuth } from './fake-supabase';

/* eslint-disable @typescript-eslint/no-require-imports -- the mock factory cannot close over an import */
jest.mock('@/account/supabase', () => require('@/account/fake-supabase'));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), dismissAll: jest.fn() },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const progressJson = JSON.stringify({ version: 1, days: [4] });
const notesJson = JSON.stringify({
  version: 1,
  rows: [{ day_index: 1, body: 'Kept', updated_at: '2026-11-18T12:00:00.000Z' }],
});

describe('More and Account', () => {
  beforeEach(async () => {
    resetFakeAuth();
    jest.mocked(router.push).mockClear();
    jest.mocked(router.back).mockClear();
    await AsyncStorage.clear();
  });

  it('shows Account as not signed in, and opens the account screen', async () => {
    await render(
      <ReadingProviders>
        <MoreScreen />
      </ReadingProviders>,
    );
    expect(await screen.findByRole('button', { name: 'Account, Not signed in' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Timeline, The 11 eras/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Who’s who, Peoples and prophets/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Settings, Reminder, appearance, translation/ })).toBeOnTheScreen();
    expect(screen.queryByText('Subscription')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Account, Not signed in' }));
    expect(router.push).toHaveBeenCalledWith('/more/account');
  });

  it('says nothing about sign-in while the session is still loading', async () => {
    let release: () => void = () => {};
    fakeAuth.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await render(
      <ReadingProviders>
        <MoreScreen />
      </ReadingProviders>,
    );
    expect(screen.getByRole('button', { name: 'Account' })).toBeOnTheScreen();
    expect(screen.queryByText('Not signed in')).toBeNull();
    await act(async () => {
      release();
    });
    expect(await screen.findByRole('button', { name: 'Account, Not signed in' })).toBeOnTheScreen();
  });

  it('names the account by email when signed in', async () => {
    fakeAuth.session = { access_token: 'token', user: { id: 'user-1', email: 'reader@example.com' } };
    await render(
      <ReadingProviders>
        <MoreScreen />
      </ReadingProviders>,
    );
    expect(await screen.findByRole('button', { name: 'Account, reader@example.com' })).toBeOnTheScreen();
  });

  it('offers sign in while signed out, and the quiet line when sign in is not set up', async () => {
    await render(
      <ReadingProviders>
        <AccountRoute />
      </ReadingProviders>,
    );
    expect(await screen.findByText('Not signed in')).toBeOnTheScreen();
    expect(screen.getByText('Your progress and notes are kept on this phone.')).toBeOnTheScreen();
    expect(screen.getByText(/New here\?/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(router.push).toHaveBeenCalledWith('/sign-in');

    await screen.unmount();
    fakeAuth.configured = false;
    await render(
      <ReadingProviders>
        <AccountRoute />
      </ReadingProviders>,
    );
    expect(await screen.findByText('Sign in isn’t set up on this copy of the app.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  });

  it('signs out locally and leaves progress and notes on the phone', async () => {
    fakeAuth.session = { access_token: 'token', user: { id: 'user-1', email: 'reader@example.com' } };
    await AsyncStorage.setItem(PROGRESS_KEY, progressJson);
    await AsyncStorage.setItem(NOTES_KEY, notesJson);
    await render(
      <ReadingProviders>
        <AccountRoute />
      </ReadingProviders>,
    );
    expect(await screen.findByText('reader@example.com')).toBeOnTheScreen();
    expect(screen.getByText(OFFLINE_LINE)).toBeOnTheScreen();
    expect(screen.getByText('Signing out keeps your progress and notes on this phone.')).toBeOnTheScreen();
    const progress = await AsyncStorage.getItem(PROGRESS_KEY);
    const notes = await AsyncStorage.getItem(NOTES_KEY);
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(fakeAuth.calls.filter((call) => call.method === 'signOut').map((call) => call.args)).toEqual([[{ scope: 'local' }]]);
    expect(await AsyncStorage.getItem(PROGRESS_KEY)).toBe(progress);
    expect(await AsyncStorage.getItem(NOTES_KEY)).toBe(notes);
    expect(notes).toContain('Kept');
    expect(await screen.findByText('Not signed in')).toBeOnTheScreen();
  });

  it('shows syncing, synced, offline, and a refused change', async () => {
    fakeAuth.session = { access_token: 'token', user: { id: 'user-1', email: 'reader@example.com' } };
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.push(listener as (state: string) => void);
      return { remove: jest.fn() };
    });
    const server = createFakeServer();
    let release = () => {};
    const held: { device: FakeDevice | null } = { device: null };
    function Marker() {
      const { mark } = useProgress();
      return (
        <>
          <Pressable onPress={() => mark(0)}>
            <Text>Mark 0</Text>
          </Pressable>
          <Pressable onPress={() => mark(1)}>
            <Text>Mark 1</Text>
          </Pressable>
        </>
      );
    }
    await render(
      <ReadingProviders
        remoteFor={(userId) => {
          const next = server.device(userId);
          release = next.holdNextPull();
          held.device = next;
          return next;
        }}
      >
        <AccountRoute />
        <Marker />
      </ReadingProviders>,
    );
    expect(await screen.findByText(SYNCING_LINE)).toBeOnTheScreen();
    await act(async () => {
      release();
    });
    expect(await screen.findByText(SYNCED_LINE)).toBeOnTheScreen();

    const device = held.device;
    if (!device) throw new Error('sync never asked for a remote');
    device.online = false;
    await fireEvent.press(screen.getByText('Mark 0'));
    expect(await screen.findByText(OFFLINE_LINE, {}, { timeout: 4000 })).toBeOnTheScreen();

    device.online = true;
    await act(async () => {
      for (const listener of listeners) listener('active');
    });
    expect(await screen.findByText(SYNCED_LINE, {}, { timeout: 4000 })).toBeOnTheScreen();

    device.refuseNext('putDays');
    await fireEvent.press(screen.getByText('Mark 1'));
    await waitFor(() => expect(screen.getByText('1 change could not be synced.')).toBeOnTheScreen(), { timeout: 4000 });
  }, 15000);
});
