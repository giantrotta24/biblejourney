import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { SessionProvider } from '@/account/session';
import { ReadingProviders } from '@/app/providers';
import { AccountBody } from '@/components/account-body';
import { OFFLINE_LINE, SYNCED_LINE, SYNCING_LINE } from '@/sync/copy';
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
    expect(screen.queryByText('Timeline')).toBeNull();
    expect(screen.queryByText('Settings')).toBeNull();
    expect(screen.queryByText('Subscription')).toBeNull();
    expect(screen.queryByText(/Who/)).toBeNull();
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

  it('shows syncing, synced, and offline while signed in', async () => {
    fakeAuth.session = { access_token: 'token', user: { id: 'user-1', email: 'reader@example.com' } };
    const lines = [
      ['syncing', SYNCING_LINE],
      ['synced', SYNCED_LINE],
      ['offline', OFFLINE_LINE],
    ] as const;
    for (const [status, line] of lines) {
      const view = await render(
        <SessionProvider>
          <AccountBody onBack={() => {}} onSignIn={() => {}} syncStatus={status} />
        </SessionProvider>,
      );
      expect(await screen.findByText(line)).toBeOnTheScreen();
      await view.unmount();
    }
  });
});
