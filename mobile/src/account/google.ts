import { createURL } from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { authErrorLine, SIGN_IN_CANCELED, SIGN_IN_FAILED, SIGN_IN_UNAVAILABLE, type AuthResult } from './errors';
import { supabase } from './supabase';

function readCallback(url: string): { kind: 'code'; code: string } | { kind: 'error' } | { kind: 'empty' } {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get('error') || parsed.searchParams.get('error_description')) return { kind: 'error' };
    const code = parsed.searchParams.get('code');
    if (!code) return { kind: 'empty' };
    return { kind: 'code', code };
  } catch {
    return { kind: 'empty' };
  }
}

export async function signInWithGoogle(): Promise<AuthResult> {
  if (!supabase) return { ok: false, line: SIGN_IN_UNAVAILABLE };
  try {
    const redirectTo = createURL('auth-callback');
    const started = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (started.error || !started.data.url) return { ok: false, line: authErrorLine(started.error) };
    const returned = await WebBrowser.openAuthSessionAsync(started.data.url, redirectTo);
    if (returned.type !== 'success') return { ok: false, line: SIGN_IN_CANCELED };
    const callback = readCallback(returned.url);
    if (callback.kind === 'error') return { ok: false, line: SIGN_IN_FAILED };
    if (callback.kind !== 'code') return { ok: false, line: SIGN_IN_FAILED };
    const exchanged = await supabase.auth.exchangeCodeForSession(callback.code);
    if (exchanged.error) return { ok: false, line: authErrorLine(exchanged.error) };
    return { ok: true };
  } catch (error) {
    return { ok: false, line: authErrorLine(error) };
  }
}
