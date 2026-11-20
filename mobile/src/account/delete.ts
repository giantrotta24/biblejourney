import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

export const DELETE_FAILED = 'Couldn’t delete your account. Try again in a moment.';
export const DELETE_OFFLINE = 'Couldn’t delete your account. Check your connection and try again.';

const DELETE_TIMEOUT_MS = 30_000;

export type DeleteFailure = 'network' | 'rejected';
export type DeleteResult = { ok: true } | { ok: false; reason: DeleteFailure };

export async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function requestAccountDelete(token: string): Promise<DeleteResult> {
  if (!supabaseUrl || !supabaseAnonKey || !token) return { ok: false, reason: 'rejected' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DELETE_TIMEOUT_MS);
  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/account-delete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, reason: 'rejected' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
