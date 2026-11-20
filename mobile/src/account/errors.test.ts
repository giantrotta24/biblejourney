import { describe, expect, it } from '@jest/globals';

import { authErrorLine } from './errors';

describe('auth errors', () => {
  it('maps rate limits, network failures, and every other failure', () => {
    expect(authErrorLine({ status: 429, message: 'email rate limit exceeded' })).toBe(
      'Too many tries. Wait a minute and try again.',
    );
    expect(authErrorLine({ code: 'over_email_send_rate_limit', message: 'please wait' })).toBe(
      'Too many tries. Wait a minute and try again.',
    );
    expect(authErrorLine({ code: 'over_request_rate_limit', message: 'slow down' })).toBe(
      'Too many tries. Wait a minute and try again.',
    );
    expect(authErrorLine({ name: 'AuthRetryableFetchError', status: 0, message: 'Network request failed' })).toBe(
      'Couldn’t reach the server. Check your connection.',
    );
    expect(authErrorLine(new TypeError('Failed to fetch'))).toBe('Couldn’t reach the server. Check your connection.');
    expect(authErrorLine({ status: 500, message: 'database exploded' })).toBe('Something went wrong. Try again.');
  });
});
