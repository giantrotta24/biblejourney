export type SyncAction = 'start' | 'stop' | 'none';

/**
 * A null INITIAL_SESSION is not a sign-out. auth-js emits one on an offline cold
 * start while the stored session is still there, and stopping would unlink the phone.
 */
export function syncAction(event: string, sessionUserId: string | null, syncingUserId: string | null): SyncAction {
  if (sessionUserId) return sessionUserId === syncingUserId ? 'none' : 'start';
  if (event === 'INITIAL_SESSION') return 'none';
  return syncingUserId !== null || event === 'SIGNED_OUT' ? 'stop' : 'none';
}
