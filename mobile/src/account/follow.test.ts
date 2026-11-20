import { describe, expect, it } from '@jest/globals';

import { syncAction } from './follow';

describe('syncAction', () => {
  it('starts syncing for a newly signed-in user', () => {
    expect(syncAction('SIGNED_IN', 'a', null)).toBe('start');
    expect(syncAction('INITIAL_SESSION', 'a', null)).toBe('start');
    expect(syncAction('SIGNED_IN', 'b', 'a')).toBe('start');
  });

  it('leaves a running sync alone for the same user', () => {
    expect(syncAction('TOKEN_REFRESHED', 'a', 'a')).toBe('none');
  });

  it('stops when the session is gone and a user is syncing, except a null initial session', () => {
    expect(syncAction('SIGNED_OUT', null, 'a')).toBe('stop');
    expect(syncAction('TOKEN_REFRESHED', null, 'a')).toBe('stop');
    expect(syncAction('INITIAL_SESSION', null, 'a')).toBe('none');
  });

  it('does nothing without a session when nothing is syncing, except unlinking on an explicit sign-out', () => {
    expect(syncAction('INITIAL_SESSION', null, null)).toBe('none');
    expect(syncAction('SIGNED_OUT', null, null)).toBe('stop');
  });
});
