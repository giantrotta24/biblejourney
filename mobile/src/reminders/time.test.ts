import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { formatReminderTime, reminderMoments, zonedInstant } from './time';

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

describe('spring-forward gap', () => {
  it('moves 2:30 on the missing hour forward to 7:30Z', () => {
    expect(zonedInstant(2027, 3, 14, 2, 30, 'America/New_York').toISOString()).toBe('2027-03-14T07:30:00.000Z');
  });

  it('keeps 7:00 local on every morning across the gap', () => {
    const moments = reminderMoments({
      now: new Date('2027-03-13T11:00:00.000Z'),
      hour: 7,
      minute: 0,
      timeZone: 'America/New_York',
      skipToday: false,
    });
    const hours = moments.map((moment) => {
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          hour: '2-digit',
          hourCycle: 'h23',
        })
          .formatToParts(moment)
          .map((part) => [part.type, part.value]),
      );
      const hour = Number(parts.hour);
      return hour === 24 ? 0 : hour;
    });
    expect(moments).toHaveLength(7);
    expect(hours).toEqual([7, 7, 7, 7, 7, 7, 7]);
  });
});
