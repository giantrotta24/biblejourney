import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import './expect-matchers';
import { resetFakeAuth } from './fake-supabase';

/* eslint-disable @typescript-eslint/no-require-imports -- the mock factory cannot close over an import */
jest.mock('@/account/supabase', () => require('@/account/fake-supabase'));
/* eslint-enable @typescript-eslint/no-require-imports */

async function openSignIn() {
  const view = await renderRouter('src/app', { initialUrl: '/' });
  await act(async () => {
    router.push('/sign-in');
  });
  expect(view.getPathname()).toBe('/sign-in');
  expect(screen.getByRole('button', { name: 'Email me a code' })).toBeOnTheScreen();
  return view;
}

async function sendCode() {
  await fireEvent.changeText(screen.getByLabelText('Email address'), 'reader@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
  expect(screen.getByText('Check your email')).toBeOnTheScreen();
}

describe('sign-in sheet', () => {
  beforeEach(() => {
    resetFakeAuth();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('closes after a valid code', async () => {
    const view = await openSignIn();
    await sendCode();
    await fireEvent.changeText(screen.getByLabelText('Email code'), '482917');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(view.getPathname().startsWith('/sign-in')).toBe(false);
    expect(screen.queryByText('Check your email')).toBeNull();
    expect(screen.queryByLabelText('Email address')).toBeNull();
  });

  it('closes when cancel is pressed on the code step', async () => {
    const view = await openSignIn();
    await sendCode();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(view.getPathname().startsWith('/sign-in')).toBe(false);
    expect(screen.queryByText('Check your email')).toBeNull();
    expect(screen.queryByLabelText('Email address')).toBeNull();
  });
});
