import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { requestAccountDelete } from '@/account/delete';

/* eslint-disable @typescript-eslint/no-require-imports -- the mock factory cannot close over an import */
jest.mock('@/account/supabase', () => require('@/account/fake-supabase'));
/* eslint-enable @typescript-eslint/no-require-imports */

describe('requestAccountDelete', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(globalThis, 'fetch').mockImplementation((async (_url: string, init?: { signal?: AbortSignal }) => {
      return await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    }) as typeof fetch);
  });

  it('treats a request that runs past 30 seconds as a connection failure', async () => {
    const pending = requestAccountDelete('token');
    await jest.advanceTimersByTimeAsync(30_000);
    await expect(pending).resolves.toEqual({ ok: false, reason: 'network' });
  });
});
