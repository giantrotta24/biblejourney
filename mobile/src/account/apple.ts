import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { authErrorLine, SIGN_IN_FAILED, SIGN_IN_UNAVAILABLE, type AuthResult } from './errors';
import { supabase } from './supabase';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isAppleCancel(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code: unknown }).code === 'ERR_REQUEST_CANCELED');
}

export async function signInWithApple(): Promise<AuthResult> {
  if (!supabase) return { ok: false, line: SIGN_IN_UNAVAILABLE };
  try {
    const bytes = await Crypto.getRandomBytesAsync(32);
    const rawNonce = bytesToHex(bytes);
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) return { ok: false, line: SIGN_IN_FAILED };
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) return { ok: false, line: authErrorLine(error) };
    return { ok: true };
  } catch (error) {
    if (isAppleCancel(error)) return { ok: false, line: null };
    return { ok: false, line: authErrorLine(error) };
  }
}
