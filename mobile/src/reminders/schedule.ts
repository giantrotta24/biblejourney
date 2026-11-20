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
  type NotificationResponse,
} from 'expo-notifications';

import { currentDay } from '../../../supabase/functions/_shared/content/plan';

import { readOnLocalDate, reminderMoments } from './time';

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
let tail: Promise<void> = Promise.resolve();

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

async function apply(input: ReminderScheduleInput, now: Date, timeZone: string) {
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
  for (let index = 0; index < moments.length; index += 1) {
    const date = moments[index];
    if (!date) continue;
    await scheduleNotificationAsync({
      identifier: `biblejourney.daily.${index}`,
      content: {
        title: REMINDER_TITLE,
        body,
        data: { url: '/' },
        sound: true,
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date,
        channelId: DAILY_CHANNEL_ID,
      },
    });
  }
}

export function syncReminderSchedule(input: ReminderScheduleInput): Promise<void> {
  const now = clock();
  const timeZone = zoneReader();
  const job = tail.then(() => apply(input, now, timeZone));
  tail = job.then(
    () => undefined,
    () => undefined,
  );
  return job;
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
