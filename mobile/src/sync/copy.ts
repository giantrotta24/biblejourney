import type { SyncStatus } from './engine';

export const KEPT_ON_PHONE = 'Your progress and notes are kept on this phone.';
export const SYNCED_LINE = 'Your progress and notes are up to date on every device you’ve signed in on.';
export const SYNCING_LINE = 'Syncing…';
export const OFFLINE_LINE =
  'Not synced yet. Your changes are safe on this phone and will sync when you’re back online.';
export const SIGNED_IN_NOTE = 'Signed in. Your progress came with you.';

export function accountLine(signedIn: boolean, status: SyncStatus, rejected = 0): string {
  if (!signedIn) return KEPT_ON_PHONE;
  if (status === 'syncing') return SYNCING_LINE;
  if (rejected > 0) return `${rejected === 1 ? '1 change' : `${rejected} changes`} could not be synced.`;
  if (status === 'synced') return SYNCED_LINE;
  return OFFLINE_LINE;
}
