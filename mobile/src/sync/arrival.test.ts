import { describe, expect, it } from '@jest/globals';

import { createArrival } from './arrival';

describe('signed-in note', () => {
  it('shows once after a fresh sign-in sync, and not for a restored session', () => {
    const arrival = createArrival();
    arrival.onAuth('INITIAL_SESSION');
    arrival.onStatus('synced');
    expect(arrival.visible()).toBe(false);

    arrival.onAuth('SIGNED_IN');
    expect(arrival.visible()).toBe(false);
    arrival.onStatus('syncing');
    expect(arrival.visible()).toBe(false);
    arrival.onStatus('synced');
    expect(arrival.visible()).toBe(true);

    arrival.dismiss();
    expect(arrival.visible()).toBe(false);
    arrival.onStatus('synced');
    expect(arrival.visible()).toBe(false);
  });
});
