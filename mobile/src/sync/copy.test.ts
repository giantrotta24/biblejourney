import { describe, expect, it } from '@jest/globals';

import { accountLine, SIGNED_IN_NOTE } from './copy';

describe('account sync lines', () => {
  it('names synced, syncing, and not-yet for a signed-in reader', () => {
    expect(accountLine(false, 'synced')).toBe('Your progress and notes are kept on this phone.');
    expect(accountLine(true, 'synced')).toBe(
      'Your progress and notes are up to date on every device you’ve signed in on.',
    );
    expect(accountLine(true, 'syncing')).toBe('Syncing…');
    expect(accountLine(true, 'offline')).toBe(
      'Not synced yet. Your changes are safe on this phone and will sync when you’re back online.',
    );
    expect(accountLine(true, 'off')).toBe(accountLine(true, 'offline'));
    expect(SIGNED_IN_NOTE).toBe('Signed in. Your progress came with you.');
  });
});
