// Outside src/app so Expo Router does not bundle this test into the app.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { fakeAuth, resetFakeAuth } from '@/account/fake-supabase';
import PlanScreen from '@/app/(tabs)/plan';
import { ReadingProviders } from '@/providers';
import { createFakeServer, type FakeDevice } from '@/sync/fake-remote';

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

const USER = 'user-1';
const DAY_ONE = 'Day 1, Genesis 1–4';

function serverDays(server: ReturnType<typeof createFakeServer>) {
  return server.rows(USER).days.map((row) => row.day_index);
}

describe('Plan day checks', () => {
  beforeEach(async () => {
    resetFakeAuth();
    jest.mocked(router.navigate).mockClear();
    await AsyncStorage.clear();
  });

  it('marks a day from its check and unmarks it, and both reach the account', async () => {
    fakeAuth.session = { access_token: 'token', user: { id: USER, email: 'reader@example.com' } };
    const server = createFakeServer();
    const held: { phone: FakeDevice | null } = { phone: null };
    await render(
      <GestureHandlerRootView>
        <ReadingProviders
          remoteFor={(userId) => {
            held.phone = server.device(userId);
            return held.phone;
          }}>
          <PlanScreen />
        </ReadingProviders>
      </GestureHandlerRootView>,
    );

    await fireEvent.press(await screen.findByRole('checkbox', { name: DAY_ONE }));
    await waitFor(() => expect(serverDays(server)).toEqual([0]), { timeout: 4000 });
    expect(screen.getByRole('checkbox', { name: DAY_ONE }).props.accessibilityState).toMatchObject({ checked: true });

    await fireEvent.press(screen.getByRole('checkbox', { name: DAY_ONE }));
    expect(screen.getByRole('checkbox', { name: DAY_ONE }).props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByText(/^0 of 312 days read/)).toBeOnTheScreen();
    await waitFor(() => expect(serverDays(server)).toEqual([]), { timeout: 4000 });
    expect(held.phone?.calls).toContain('deleteDay');
    expect(router.navigate).not.toHaveBeenCalled();
  }, 15000);
});
