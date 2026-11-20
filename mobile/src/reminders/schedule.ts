import {
  AndroidImportance,
  DEFAULT_ACTION_IDENTIFIER,
  SchedulableTriggerInputTypes,
  addNotificationResponseReceivedListener,
  cancelAllScheduledNotificationsAsync,
  clearLastNotificationResponse,
  getLastNotificationResponse,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  type CalendarTriggerInput,
  type DateTriggerInput,
  type NotificationResponse,
} from 'expo-notifications';
import { Platform } from 'react-native';

import { currentDay } from '../../../supabase/functions/_shared/content/plan';

import { civilTime, readOnLocalDate, reminderMoments } from './time';

export const REMINDER_TITLE = 'Today\u2019s reading is ready';
export const DAILY_CHANNEL_ID = 'daily-reading';
export const DAILY_CHANNEL_NAME = 'Daily reading';

type ReminderScheduleInput = {
  enabled: boolean;
  hour: number;
  minute: number;
  rows: readonly { day_index: number; completed_at: string }[];
};

let clock: () => Date = () => new Date();
let zoneReader: () => string = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
let pollMs = 30_000;
let busy = false;
let nextInput: ReminderScheduleInput | null = null;
let nextWait: Promise<void> | null = null;
let resolveNext: (() => void) | null = null;
let rejectNext: ((error: unknown) => void) | null = null;

export function setReminderClockForTests(next: () => Date) {
  clock = next;
}

export function setReminderTimeZoneForTests(next: () => string) {
  zoneReader = next;
}

export function setTimeZonePollForTests(ms: number) {
  pollMs = ms;
}

setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function triggerFor(date: Date, timeZone: string): CalendarTriggerInput | DateTriggerInput {
  if (Platform.OS === 'android') {
    const trigger: DateTriggerInput = {
      type: SchedulableTriggerInputTypes.DATE,
      date,
      channelId: DAILY_CHANNEL_ID,
    };
    return trigger;
  }
  const parts = civilTime(date, timeZone);
  const trigger: CalendarTriggerInput = {
    type: SchedulableTriggerInputTypes.CALENDAR,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    repeats: false,
  };
  return trigger;
}

async function apply(input: ReminderScheduleInput) {
  const now = clock();
  const timeZone = zoneReader();
  if (!input.enabled) {
    await cancelAllScheduledNotificationsAsync();
    return;
  }
  await setNotificationChannelAsync(DAILY_CHANNEL_ID, {
    name: DAILY_CHANNEL_NAME,
    importance: AndroidImportance.DEFAULT,
  });
  const done = new Set(input.rows.map((row) => row.day_index));
  const body = currentDay(done)?.reading ?? null;
  await cancelAllScheduledNotificationsAsync();
  if (!body) return;
  const moments = reminderMoments({
    now,
    hour: input.hour,
    minute: input.minute,
    timeZone,
    skipToday: readOnLocalDate(
      input.rows.map((row) => row.completed_at),
      now,
      timeZone,
    ),
  });
  let failure: unknown = null;
  for (let index = 0; index < moments.length; index += 1) {
    const date = moments[index];
    if (!date) continue;
    try {
      await scheduleNotificationAsync({
        identifier: `biblejourney.daily.${index}`,
        content: {
          title: REMINDER_TITLE,
          body,
          sound: true,
        },
        trigger: triggerFor(date, timeZone),
      });
    } catch (error) {
      failure ??= error;
    }
  }
  if (failure) throw failure;
}

export function syncReminderSchedule(input: ReminderScheduleInput): Promise<void> {
  if (busy) {
    nextInput = input;
    if (!nextWait) {
      nextWait = new Promise((resolve, reject) => {
        resolveNext = resolve;
        rejectNext = reject;
      });
    }
    return nextWait;
  }
  busy = true;
  return apply(input).finally(() => {
    busy = false;
    const follow = nextInput;
    const resolve = resolveNext;
    const reject = rejectNext;
    nextInput = null;
    nextWait = null;
    resolveNext = null;
    rejectNext = null;
    if (!follow || !resolve || !reject) return undefined;
    return syncReminderSchedule(follow).then(resolve, reject);
  });
}

export function watchTimeZone(onChange: () => void): () => void {
  let zone = zoneReader();
  const timer = setInterval(() => {
    const next = zoneReader();
    if (next === zone) return;
    zone = next;
    onChange();
  }, pollMs);
  return () => clearInterval(timer);
}

export function listenForNotificationOpen(openToday: () => void): () => void {
  const open = (response: NotificationResponse | null) => {
    if (!response || response.actionIdentifier !== DEFAULT_ACTION_IDENTIFIER) return;
    openToday();
    clearLastNotificationResponse();
  };
  const subscription = addNotificationResponseReceivedListener(open);
  open(getLastNotificationResponse());
  return () => subscription.remove();
}
