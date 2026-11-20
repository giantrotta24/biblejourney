import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen } from '@testing-library/react-native';
import { AppState, Text } from 'react-native';

import { SessionProvider, useSession } from '@/account/session';

import { fakeAuth, resetFakeAuth } from './fake-supabase';

/* eslint-disable @typescript-eslint/no-require-imports -- the mock factory cannot close over an import */
jest.mock('@/account/supabase', () => require('@/account/fake-supabase'));
/* eslint-enable @typescript-eslint/no-require-imports */

function Status() {
  const session = useSession();
  return <Text>{`${session.status}:${session.email ?? ''}:${session.user?.id ?? ''}`}</Text>;
}

describe('session', () => {
  beforeEach(() => {
    resetFakeAuth();
    jest.restoreAllMocks();
  });

  it('waits, then follows the stored session and later auth changes', async () => {
    let release: () => void = () => {};
    fakeAuth.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    await render(
      <SessionProvider>
        <Status />
      </SessionProvider>,
    );
    expect(screen.getByText('loading::')).toBeOnTheScreen();
    await act(async () => {
      release();
    });
    expect(await screen.findByText('signed-out::')).toBeOnTheScreen();

    const next = { access_token: 'token', user: { id: 'user-1', email: 'reader@example.com' } };
    await act(async () => {
      for (const listener of fakeAuth.listeners) listener('SIGNED_IN', next);
    });
    expect(screen.getByText('signed-in:reader@example.com:user-1')).toBeOnTheScreen();
  });

  it('starts signed out when no session is stored', async () => {
    await render(
      <SessionProvider>
        <Status />
      </SessionProvider>,
    );
    expect(await screen.findByText('signed-out::')).toBeOnTheScreen();
  });

  it('is unavailable when sign-in is not set up, and does not touch auth', async () => {
    fakeAuth.configured = false;
    await render(
      <SessionProvider>
        <Status />
      </SessionProvider>,
    );
    expect(screen.getByText('unavailable::')).toBeOnTheScreen();
    expect(fakeAuth.calls).toEqual([]);
    expect(fakeAuth.listeners).toEqual([]);
  });

  it('refreshes the session while the app is active and stops when it is not', async () => {
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      listeners.push(listener as (state: string) => void);
      return { remove: jest.fn() };
    });
    await render(
      <SessionProvider>
        <Status />
      </SessionProvider>,
    );
    const listener = listeners.at(-1);
    expect(listener).toBeDefined();
    await act(async () => listener?.('active'));
    expect(fakeAuth.calls.some((call) => call.method === 'startAutoRefresh')).toBe(true);
    await act(async () => listener?.('background'));
    expect(fakeAuth.calls.some((call) => call.method === 'stopAutoRefresh')).toBe(true);
  });
});
