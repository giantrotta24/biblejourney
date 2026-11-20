import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { SessionProvider } from '@/account/session';
import AuthCallback from '@/app/auth-callback';
import SignInRoute from '@/app/sign-in/index';

import { fakeAuth, resetFakeAuth } from './fake-supabase';

/* eslint-disable @typescript-eslint/no-require-imports -- the mock factory cannot close over an import */
jest.mock('@/account/supabase', () => require('@/account/fake-supabase'));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    dismissAll: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: () => ({}),
  Redirect: () => null,
}));
jest.mock('expo-linking', () => ({
  createURL: (path: string) => `biblejourney://${path}`,
}));
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
  openBrowserAsync: jest.fn(),
}));

async function renderSignIn() {
  await render(
    <SessionProvider>
      <SignInRoute />
    </SessionProvider>,
  );
}

describe('Apple and Google', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    resetFakeAuth();
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => originalOS });
    jest.mocked(router.dismissAll).mockClear();
    jest.mocked(router.back).mockClear();
    jest.mocked(router.replace).mockClear();
    jest.mocked(router.canGoBack).mockReturnValue(true);
    jest.mocked(AppleAuthentication.signInAsync).mockReset();
    jest.mocked(WebBrowser.openAuthSessionAsync).mockReset();
  });

  it('hides Apple on Android', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    await renderSignIn();
    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeOnTheScreen();
  });

  it('stays quiet when Apple sign in is canceled, and sends the raw nonce', async () => {
    jest.mocked(AppleAuthentication.signInAsync).mockRejectedValueOnce(
      Object.assign(new Error('The user canceled the authorization attempt'), { code: 'ERR_REQUEST_CANCELED' }),
    );
    await renderSignIn();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Apple' }));
    expect(screen.queryByText('Sign in was canceled.')).toBeNull();
    expect(screen.queryByText('Something went wrong. Try again.')).toBeNull();
    expect(fakeAuth.calls.filter((call) => call.method === 'signInWithIdToken')).toEqual([]);
    expect(router.dismissAll).not.toHaveBeenCalled();

    jest.mocked(AppleAuthentication.signInAsync).mockResolvedValueOnce({ identityToken: 'apple-token' } as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Apple' }));
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(Crypto.CryptoDigestAlgorithm.SHA256, '0102ff');
    expect(AppleAuthentication.signInAsync).toHaveBeenLastCalledWith({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: 'hashed-nonce',
    });
    expect(fakeAuth.calls.find((call) => call.method === 'signInWithIdToken')?.args[0]).toEqual({
      provider: 'apple',
      token: 'apple-token',
      nonce: '0102ff',
    });
    expect(router.dismissAll).toHaveBeenCalledTimes(1);
  });

  it('treats a closed Google window and an error in the URL as one quiet line', async () => {
    jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValueOnce({ type: 'cancel' } as never);
    await renderSignIn();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(fakeAuth.calls.find((call) => call.method === 'signInWithOAuth')?.args[0]).toEqual({
      provider: 'google',
      options: { redirectTo: 'biblejourney://auth-callback', skipBrowserRedirect: true },
    });
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(fakeAuth.oauthUrl, 'biblejourney://auth-callback');
    expect(screen.getByText('Sign in was canceled.')).toBeOnTheScreen();
    expect(fakeAuth.calls.filter((call) => call.method === 'exchangeCodeForSession')).toEqual([]);
    expect(router.dismissAll).not.toHaveBeenCalled();

    jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValueOnce({
      type: 'success',
      url: 'biblejourney://auth-callback?error=access_denied&error_description=Raw%20provider%20blew%20up',
    } as never);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(screen.getByText('Something went wrong. Try again.')).toBeOnTheScreen();
    expect(screen.queryByText(/Raw provider blew up/)).toBeNull();
    expect(fakeAuth.calls.filter((call) => call.method === 'exchangeCodeForSession')).toEqual([]);
  });

  it('exchanges the Google code and closes the sheet', async () => {
    jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValueOnce({
      type: 'success',
      url: 'biblejourney://auth-callback?code=the-code',
    } as never);
    await renderSignIn();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(fakeAuth.calls.find((call) => call.method === 'exchangeCodeForSession')?.args).toEqual(['the-code']);
    expect(router.dismissAll).toHaveBeenCalledTimes(1);
  });

  it('returns from the auth callback to the screen underneath, or home if there is none', async () => {
    await render(<AuthCallback />);
    expect(router.back).toHaveBeenCalledTimes(1);

    await screen.unmount();
    jest.mocked(router.back).mockClear();
    jest.mocked(router.canGoBack).mockReturnValue(false);
    await render(<AuthCallback />);
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(router.back).not.toHaveBeenCalled();
  });
});
