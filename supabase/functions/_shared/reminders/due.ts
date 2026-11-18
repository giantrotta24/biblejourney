export type ReminderSchedule = {
  timezone: string;
  reminderTime: string | null;
  lastRemindedOn: string | null;
};

export const DUE_WINDOW_MINUTES = 60;

const MINUTES_PER_DAY = 24 * 60;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let value = formatters.get(timeZone);
  if (!value) {
    try {
      value = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      });
    } catch {
      value = formatter("UTC");
    }
    formatters.set(timeZone, value);
  }
  return value;
}

export function localClock(now: Date, timeZone: string): { date: string; minutes: number } {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(now).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function parseReminderTime(value: string | null): number | null {
  const match = value ? TIME.exec(value) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

const LONGEST_CLOCK_JUMP_MINUTES = 60;

function reachedOn(minute: { date: string; minutes: number }, reminder: number) {
  return minute.minutes >= reminder;
}

export function dueReminderDate(schedule: ReminderSchedule, now: Date): string | null {
  const reminder = parseReminderTime(schedule.reminderTime);
  if (reminder === null) return null;
  const wall = localClock(now, schedule.timezone).minutes;
  if ((wall - reminder + MINUTES_PER_DAY) % MINUTES_PER_DAY >= DUE_WINDOW_MINUTES + LONGEST_CLOCK_JUMP_MINUTES) return null;

  for (let back = 0; back < DUE_WINDOW_MINUTES; back++) {
    const minute = localClock(new Date(now.getTime() - back * 60_000), schedule.timezone);
    if (!reachedOn(minute, reminder)) continue;
    const before = localClock(new Date(now.getTime() - (back + 1) * 60_000), schedule.timezone);
    if (before.date === minute.date && reachedOn(before, reminder)) continue;
    if (schedule.lastRemindedOn !== null && schedule.lastRemindedOn >= minute.date) return null;
    return minute.date;
  }
  return null;
}
