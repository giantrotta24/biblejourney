import { supabase } from './supabase';

export const DELETE_FAILED = 'Couldn’t delete your account. Check your connection and try again.';

/** Read at call time so a test can point at a stand-in before the build inlines the public env. */
export const accountDeleteEnv = {
  base: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  anon: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function requestAccountDelete(token: string): Promise<boolean> {
  const base = accountDeleteEnv.base || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = accountDeleteEnv.anon || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !anon || !token) return false;
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/functions/v1/account-delete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anon,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { ok?: unknown };
    return body.ok === true;
  } catch {
    return false;
  }
}
