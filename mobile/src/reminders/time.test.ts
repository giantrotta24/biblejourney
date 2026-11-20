import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { formatReminderTime } from './time';

describe('formatReminderTime', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the device locale', () => {
    const Original = Intl.DateTimeFormat;
    jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((locales, options) => {
      return new Original(locales === undefined ? 'en-GB' : (locales as string), options);
    });
    expect(formatReminderTime(7, 5)).toBe('7:05');
    expect(formatReminderTime(15, 5)).toBe('15:05');
  });
});
