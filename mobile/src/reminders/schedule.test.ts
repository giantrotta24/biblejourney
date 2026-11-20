import { beforeEach, describe, expect, it } from '@jest/globals';
import { waitFor } from '@testing-library/react-native';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { currentDay, DAY_COUNT } from '../../../supabase/functions/_shared/content/plan';

import {
  failSchedule,
  notificationChannels,
  pauseSchedules,
  resetNotificationsMock,
  scheduleCallCount,
  scheduledNotifications,
} from './notifications-mock';
import { setReminderClockForTests, setReminderTimeZoneForTests, syncReminderSchedule } from './schedule';
import { zonedInstant } from './time';

const ZONE = 'America/New_York';
const MORNING = new Date('2026-11-20T11:00:00.000Z');
const TITLE = 'Today\u2019s reading is ready';
const WEEK = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'];
const FROM_TOMORROW = ['2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27'];

type Row = { day_index: number; completed_at: string };

function localParts(instant: Date, timeZone = ZONE) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: hour === 24 ? 0 : hour,
    minute: Number(parts.minute),
  };
}

function moments() {
  return scheduledNotifications()
    .map((item) => {
      if (item.trigger.type === 'calendar') {
        return zonedInstant(
          item.trigger.year ?? 0,
          item.trigger.month ?? 0,
          item.trigger.day ?? 0,
          item.trigger.hour ?? 0,
          item.trigger.minute ?? 0,
          ZONE,
        );
      }
      const raw = item.trigger.date;
      if (raw == null) throw new Error('a scheduled reminder has no date');
      return raw instanceof Date ? raw : new Date(raw);
    })
    .sort((a, b) => a.getTime() - b.getTime());
}

function expectReminders(dates: string[], hour: number, minute: number, body: string) {
  const scheduled = scheduledNotifications();
  expect(scheduled).toHaveLength(dates.length);
  scheduled.forEach((item, index) => {
    const date = dates[index] ?? '';
    expect(item.content.title).toBe(TITLE);
    expect(item.content.body).toBe(body);
    expect(item.content.data).toBeUndefined();
    if (Platform.OS === 'android') {
      expect(item.trigger.type).toBe('date');
      expect(item.trigger.channelId).toBe('daily-reading');
      const raw = item.trigger.date;
      if (raw == null) throw new Error('a scheduled reminder has no date');
      const moment = raw instanceof Date ? raw : new Date(raw);
      expect(localParts(moment)).toEqual({ date, hour, minute });
      return;
    }
    expect(item.trigger).toEqual({
      type: 'calendar',
      year: Number(date.slice(0, 4)),
      month: Number(date.slice(5, 7)),
      day: Number(date.slice(8, 10)),
      hour,
      minute,
      repeats: false,
    });
  });
}

async function schedule(overrides: Partial<{ enabled: boolean; hour: number; minute: number; rows: readonly Row[] }> = {}) {
  await syncReminderSchedule({ enabled: true, hour: 7, minute: 0, rows: [], ...overrides });
}

describe('daily reminder schedule', () => {
  beforeEach(() => {
    resetNotificationsMock();
    setReminderClockForTests(() => MORNING);
    setReminderTimeZoneForTests(() => ZONE);
  });

  it('schedules the next 7 mornings with the current reading', async () => {
    await schedule();
    expectReminders(WEEK, 7, 0, currentDay(new Set())?.reading ?? '');
    expect(notificationChannels()).toEqual([
      expect.objectContaining({ id: 'daily-reading', name: 'Daily reading', importance: AndroidImportance.DEFAULT }),
    ]);
    for (const moment of moments()) expect(moment.getTime()).toBeGreaterThan(MORNING.getTime());
  });

  it('skips today after a read today and keeps the rest', async () => {
    const rows = [{ day_index: 0, completed_at: '2026-11-20T11:00:00.000Z' }];
    await schedule({ rows });
    expectReminders(WEEK.slice(1), 7, 0, currentDay(new Set([0]))?.reading ?? '');
  });

  it('reschedules the body when progress changes and today was read on another date', async () => {
    await schedule();
    expect(scheduledNotifications()[0]?.content.body).toBe(currentDay(new Set())?.reading);
    await schedule({ rows: [{ day_index: 0, completed_at: '2026-11-19T15:00:00.000Z' }] });
    expectReminders(WEEK, 7, 0, currentDay(new Set([0]))?.reading ?? '');
  });

  it('starts tomorrow once today’s time has passed', async () => {
    setReminderClockForTests(() => new Date('2026-11-20T13:00:00.000Z'));
    await schedule();
    const scheduled = moments();
    expect(scheduled.map((moment) => localParts(moment).date)).toEqual(FROM_TOMORROW);
    expect(scheduled.every((moment) => moment.getTime() > new Date('2026-11-20T13:00:00.000Z').getTime())).toBe(true);
  });

  it('schedules nothing once every day is read', async () => {
    const rows = Array.from({ length: DAY_COUNT }, (_, day_index) => ({
      day_index,
      completed_at: '2026-11-19T15:00:00.000Z',
    }));
    expect(currentDay(new Set(rows.map((row) => row.day_index)))).toBeNull();
    await schedule();
    expect(scheduledNotifications()).toHaveLength(7);
    await schedule({ rows });
    expect(scheduledNotifications()).toEqual([]);
  });

  it('cancels every reminder when it is turned off', async () => {
    await schedule();
    expect(scheduledNotifications()).toHaveLength(7);
    await schedule({ enabled: false });
    expect(scheduledNotifications()).toEqual([]);
  });

  it('moves the seven days when the time changes', async () => {
    await schedule();
    await schedule({ hour: 8, minute: 30 });
    expectReminders(WEEK, 8, 30, currentDay(new Set())?.reading ?? '');
  });

  it('places 7:00 in the phone’s time zone', async () => {
    setReminderTimeZoneForTests(() => 'America/Los_Angeles');
    await schedule();
    if (Platform.OS === 'android') {
      expect(moments().map((moment) => localParts(moment, 'America/Los_Angeles').hour)).toEqual([7, 7, 7, 7, 7, 7, 7]);
      expect(moments()[0]?.getUTCHours()).toBe(15);
      return;
    }
    expect(scheduledNotifications().map((item) => item.trigger.hour)).toEqual([7, 7, 7, 7, 7, 7, 7]);
    expect(scheduledNotifications().every((item) => item.trigger.repeats === false && item.trigger.timezone === undefined)).toBe(
      true,
    );
  });

  it('keeps the other mornings when one schedule call fails', async () => {
    failSchedule('biblejourney.daily.3');
    await expect(schedule()).rejects.toThrow('schedule failed');
    const identifiers = scheduledNotifications().map((item) => item.identifier).sort();
    expect(identifiers).toEqual([
      'biblejourney.daily.0',
      'biblejourney.daily.1',
      'biblejourney.daily.2',
      'biblejourney.daily.4',
      'biblejourney.daily.5',
      'biblejourney.daily.6',
    ]);
  });

  it('schedules only the newest request when several arrive while one is running', async () => {
    const held = pauseSchedules();
    const first = syncReminderSchedule({ enabled: true, hour: 7, minute: 0, rows: [] });
    await waitFor(() => expect(scheduleCallCount()).toBe(1));
    const rest = [1, 2, 3, 4].map((minute) => syncReminderSchedule({ enabled: true, hour: 8, minute, rows: [] }));
    held.release();
    await first;
    await Promise.all(rest);
    expect(scheduleCallCount()).toBe(14);
    expect(scheduledNotifications().every((item) => (item.trigger.hour ?? localParts(triggerDate(item)).hour) === 8)).toBe(true);
    expect(scheduledNotifications().every((item) => (item.trigger.minute ?? localParts(triggerDate(item)).minute) === 4)).toBe(
      true,
    );
  });

  it('reads the clock when the schedule runs, not when it was queued', async () => {
    const held = pauseSchedules();
    let now = MORNING;
    setReminderClockForTests(() => now);
    const first = syncReminderSchedule({ enabled: true, hour: 7, minute: 0, rows: [] });
    await waitFor(() => expect(scheduleCallCount()).toBe(1));
    now = new Date('2026-11-21T11:00:00.000Z');
    const second = syncReminderSchedule({ enabled: true, hour: 7, minute: 0, rows: [] });
    now = new Date('2026-11-22T11:00:00.000Z');
    held.release();
    await first;
    await second;
    const firstDay = scheduledNotifications()
      .map((item) => (item.trigger.type === 'calendar' ? item.trigger.day : localParts(triggerDate(item)).date.slice(8)))
      .sort()[0];
    expect(String(firstDay)).toMatch(/22/);
  });
});

function triggerDate(item: { trigger: { date?: Date | number } }): Date {
  const raw = item.trigger.date;
  if (raw == null) throw new Error('a scheduled reminder has no date');
  return raw instanceof Date ? raw : new Date(raw);
}
