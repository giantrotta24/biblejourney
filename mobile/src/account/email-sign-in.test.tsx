import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert, StyleSheet } from 'react-native';

import { SessionProvider } from '@/account/session';
import SignInRoute from '@/app/sign-in/index';
import { CodeStep } from '@/components/code-step';
import { light } from '@/theme/colors';

import { fakeAuth, resetFakeAuth } from './fake-supabase';

/* eslint-disable @typescript-eslint/no-require-imports -- the mock factory cannot close over an import */
jest.mock('@/account/supabase', () => require('@/account/fake-supabase'));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

async function renderSignIn() {
  await render(
    <SessionProvider>
      <SignInRoute />
    </SessionProvider>,
  );
}

describe('email sign in', () => {
  beforeEach(() => {
    resetFakeAuth();
    jest.mocked(router.push).mockClear();
    jest.mocked(router.back).mockClear();
  });

  it('says sign in is not set up when the client is missing', async () => {
    fakeAuth.configured = false;
    await renderSignIn();
    expect(screen.getByText('Sign in isn’t set up on this copy of the app.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Email me a code' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
  });

  it('checks the email before sending, then opens the code step', async () => {
    await renderSignIn();
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(fakeAuth.calls.filter((call) => call.method === 'signInWithOtp')).toEqual([]);

    await fireEvent.changeText(screen.getByLabelText('Email address'), '  reader@example.com  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
    expect(fakeAuth.calls.find((call) => call.method === 'signInWithOtp')?.args[0]).toEqual({
      email: 'reader@example.com',
      options: { shouldCreateUser: true },
    });
    expect(screen.getByText('Check your email')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows a plain rate-limit line and not the server message', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    fakeAuth.errors.signInWithOtp = {
      message: 'For security purposes you can only request this after 60 seconds',
      status: 429,
      code: 'over_email_send_rate_limit',
    };
    try {
      await renderSignIn();
      await fireEvent.changeText(screen.getByLabelText('Email address'), 'reader@example.com');
      await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
      expect(screen.getByText('Too many tries. Wait a minute and try again.')).toBeOnTheScreen();
      expect(screen.queryByText(/security purposes/)).toBeNull();
      expect(router.push).not.toHaveBeenCalled();
      expect(alert).not.toHaveBeenCalled();
    } finally {
      alert.mockRestore();
    }
  });

  it('rejects a short code, shows a wrong code in red, and closes the sheet on success', async () => {
    await renderSignIn();
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'reader@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
    const field = screen.getByLabelText('Email code');
    expect(field.props.textContentType).toBe('oneTimeCode');
    expect(field.props.autoComplete).toBe('one-time-code');
    expect(field.props.keyboardType).toBe('number-pad');
    expect(screen.getByText('We sent a code to reader@example.com. Enter it here; it can be 6 to 10 digits.')).toBeOnTheScreen();

    await fireEvent.changeText(field, '48291');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    const wrong = screen.getByText('Enter the 6–10 digit code from your email.');
    expect(wrong).toBeOnTheScreen();
    expect(StyleSheet.flatten(wrong.props.style).color).toBe(light.danger);
    expect(StyleSheet.flatten(screen.getByLabelText('Email code').props.style).borderColor).toBe(light.danger);
    expect(fakeAuth.calls.filter((call) => call.method === 'verifyOtp')).toEqual([]);

    fakeAuth.errors.verifyOtp = { message: 'Token has expired or is invalid', code: 'otp_expired' };
    await fireEvent.changeText(screen.getByLabelText('Email code'), '482917');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter the 6–10 digit code from your email.')).toBeOnTheScreen();
    expect(screen.queryByText(/Token has expired/)).toBeNull();
    expect(router.back).not.toHaveBeenCalled();

    delete fakeAuth.errors.verifyOtp;
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(fakeAuth.calls.filter((call) => call.method === 'verifyOtp').at(-1)?.args[0]).toEqual({
      email: 'reader@example.com',
      token: '482917',
      type: 'email',
    });
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('waits 30 seconds before another code can be sent', async () => {
    jest.useFakeTimers();
    try {
      await render(
        <CodeStep email="reader@example.com" onCancel={() => {}} onBack={() => {}} onSignedIn={() => {}} />,
      );
      const resend = screen.getByRole('button', { name: 'Send a new code' });
      expect(resend).toBeDisabled();
      await fireEvent.press(resend);
      expect(fakeAuth.calls.filter((call) => call.method === 'signInWithOtp')).toEqual([]);

      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(screen.getByRole('button', { name: 'Send a new code' })).not.toBeDisabled();
      await fireEvent.press(screen.getByRole('button', { name: 'Send a new code' }));
      expect(screen.getByText('Sent')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Send a new code' })).toBeDisabled();
      expect(fakeAuth.calls.filter((call) => call.method === 'signInWithOtp')).toHaveLength(1);

      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(screen.getByRole('button', { name: 'Send a new code' })).not.toBeDisabled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('goes back for a different email and cancel closes the sheet', async () => {
    await renderSignIn();
    await fireEvent.changeText(screen.getByLabelText('Email address'), 'reader@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Use a different email' }));
    expect(screen.getByLabelText('Email address')).toBeOnTheScreen();
    expect(screen.queryByText('Check your email')).toBeNull();
    expect(router.back).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Email address'), 'reader@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Email me a code' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
