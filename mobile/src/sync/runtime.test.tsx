import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, Pressable, Text } from 'react-native';

import { fakeAuth, resetFakeAuth } from '@/account/fake-supabase';
import { ReadingProviders } from '@/app/providers';
import TodayScreen from '@/app/(tabs)/index';
import { useProgress } from '@/progress/context';
import { SIGNED_IN_NOTE } from '@/sync/copy';
import { createFakeServer, type FakeDevice } from '@/sync/fake-remote';
import { SYNC_QUEUE_KEY } from '@/sync/queue';

/* eslint-disable @typescript-eslint/no-require-imports -- the mock factory cannot close over an import */
jest.mock('@/account/supabase', () => require('@/account/fake-supabase'));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), setParams: jest.fn(), navigate: jest.fn(), dismissAll: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

const USER = 'user-1';

function Days() {
  const { days, mark } = useProgress();
  const listed = [...days].sort((a, b) => a - b).join(',');
  return (
    <>
      <Text>{`days:${listed}`}</Text>
      <Pressable onPress={() => mark(0)}>
        <Text>Mark 0</Text>
      </Pressable>
    </>
  );
}

describe('production sync wiring', () => {
  const appListeners: ((state: string) => void)[] = [];

  beforeEach(async () => {
    resetFakeAuth();
    appListeners.length = 0;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appListeners.push(listener as (state: string) => void);
      return { remove: jest.fn() };
    });
    await AsyncStorage.clear();
  });

  it('keeps the link through a null initial session and then follows the account', async () => {
    fakeAuth.session = { access_token: 'token', user: { id: USER, email: 'reader@example.com' } };
    const server = createFakeServer();
    const held: { phone: FakeDevice | null } = { phone: null };
    await render(
      <ReadingProviders
        remoteFor={(userId) => {
          held.phone = server.device(userId);
          return held.phone;
        }}
      >
        <Days />
      </ReadingProviders>,
    );
    await fireEvent.press(await screen.findByText('Mark 0'));
    await waitFor(() => expect(server.rows(USER).days.map((row) => row.day_index)).toEqual([0]), { timeout: 4000 });
    const linked = JSON.parse((await AsyncStorage.getItem(SYNC_QUEUE_KEY)) ?? '{}') as { linkedUser?: string };
    expect(linked.linkedUser).toBe(USER);

    const phone = held.phone;
    if (!phone) throw new Error('sync never asked for a remote');
    phone.online = false;
    const other = server.device(USER);
    await other.putDays([{ day_index: 1, completed_at: '2026-11-20T12:00:00.000Z' }]);
    await other.deleteDay(0);
    phone.online = true;

    await act(async () => {
      for (const listener of fakeAuth.listeners) listener('INITIAL_SESSION', null);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    const after = JSON.parse((await AsyncStorage.getItem(SYNC_QUEUE_KEY)) ?? '{}') as { linkedUser?: string };
    expect(after.linkedUser).toBe(USER);

    await act(async () => {
      for (const listener of fakeAuth.listeners) listener('TOKEN_REFRESHED', fakeAuth.session);
      for (const listener of appListeners) listener('active');
    });
    await waitFor(() => expect(screen.getByText('days:1')).toBeOnTheScreen(), { timeout: 4000 });
    expect(server.rows(USER).days.map((row) => row.day_index)).toEqual([1]);
  }, 15000);

  it('shows the Today line after a sign-in and not for a session that was already linked', async () => {
    await AsyncStorage.setItem(
      SYNC_QUEUE_KEY,
      JSON.stringify({
        version: 1,
        nextId: 1,
        ops: [],
        linkedUser: USER,
        rejectedCount: 0,
        resetSeen: null,
        refusedNotes: [],
      }),
    );
    fakeAuth.session = { access_token: 'token', user: { id: USER, email: 'reader@example.com' } };
    const server = createFakeServer();
    let release = () => {};
    await render(
      <GestureHandlerRootView>
        <ReadingProviders
          remoteFor={(userId) => {
            const device = server.device(userId);
            release = device.holdNextPull();
            return device;
          }}
        >
          <TodayScreen />
        </ReadingProviders>
      </GestureHandlerRootView>,
    );
    await act(async () => {
      for (const listener of fakeAuth.listeners) listener('SIGNED_IN', fakeAuth.session);
    });
    release();
    await waitFor(() => expect(screen.getByText('Mark day 1 read')).toBeOnTheScreen(), { timeout: 4000 });
    expect(screen.queryByText(SIGNED_IN_NOTE)).toBeNull();

    await screen.unmount();
    await AsyncStorage.clear();
    resetFakeAuth();
    fakeAuth.session = null;
    let releaseNext = () => {};
    await render(
      <GestureHandlerRootView>
        <ReadingProviders
          remoteFor={(userId) => {
            const device = server.device(userId);
            releaseNext = device.holdNextPull();
            return device;
          }}
        >
          <TodayScreen />
        </ReadingProviders>
      </GestureHandlerRootView>,
    );
    const session = { access_token: 'token', user: { id: USER, email: 'reader@example.com' } };
    await act(async () => {
      for (const listener of fakeAuth.listeners) listener('SIGNED_IN', session);
    });
    releaseNext();
    expect(await screen.findByText(SIGNED_IN_NOTE, {}, { timeout: 4000 })).toBeOnTheScreen();
  }, 15000);

  it('pulls when the app becomes active and sends a marked day', async () => {
    fakeAuth.session = { access_token: 'token', user: { id: USER, email: 'reader@example.com' } };
    const server = createFakeServer();
    const held: { phone: FakeDevice | null } = { phone: null };
    await render(
      <GestureHandlerRootView>
        <ReadingProviders
          remoteFor={(userId) => {
            held.phone = server.device(userId);
            return held.phone;
          }}
        >
          <TodayScreen />
        </ReadingProviders>
      </GestureHandlerRootView>,
    );
    const pullsOf = () => held.phone?.calls.filter((call) => call === 'pull').length ?? 0;
    await waitFor(() => expect(pullsOf()).toBeGreaterThan(0), { timeout: 4000 });
    const pulls = pullsOf();
    await act(async () => {
      for (const listener of appListeners) listener('active');
    });
    await waitFor(() => expect(pullsOf()).toBeGreaterThan(pulls), { timeout: 4000 });

    await fireEvent.press(screen.getByRole('button', { name: 'Mark day 1 read' }));
    await waitFor(() => expect(server.rows(USER).days.map((row) => row.day_index)).toEqual([0]), { timeout: 4000 });
  }, 15000);
});
