const HORIZON_DAYS = 7;

type Wall = { year: number; month: number; day: number; hour: number; minute: number };

function wall(instant: Date, timeZone: string): Wall {
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
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: hour === 24 ? 0 : hour,
    minute: Number(parts.minute),
  };
}

export function localDateKey(instant: Date, timeZone: string): string {
  const parts = wall(instant, timeZone);
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

function zoneOffset(instant: Date, timeZone: string): number {
  const parts = wall(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0);
  return asUtc - instant.getTime();
}

export function civilTime(instant: Date, timeZone: string): Wall {
  return wall(instant, timeZone);
}

export function zonedInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const corrected = zoneOffset(new Date(utc - zoneOffset(new Date(utc), timeZone)), timeZone);
  const result = new Date(utc - corrected);
  const seen = wall(result, timeZone);
  if (seen.hour === hour && seen.minute === minute) return result;
  return new Date(result.getTime() + 60 * 60 * 1000);
}

function shiftDate(year: number, month: number, day: number, offset: number): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/**
 * The next seven local mornings, or six when today is still ahead and she has already read:
 * today's note is dropped and the week is not extended to fill the gap.
 * A time that has already passed today is not one of the seven.
 */
export function reminderMoments({
  now,
  hour,
  minute,
  timeZone,
  skipToday,
}: {
  now: Date;
  hour: number;
  minute: number;
  timeZone: string;
  skipToday: boolean;
}): Date[] {
  const today = wall(now, timeZone);
  const todayAt = zonedInstant(today.year, today.month, today.day, hour, minute, timeZone);
  const todayPending = todayAt.getTime() > now.getTime();
  const start = todayPending && !skipToday ? 0 : 1;
  const count = todayPending && skipToday ? HORIZON_DAYS - 1 : HORIZON_DAYS;
  const moments: Date[] = [];
  for (let index = 0; index < count; index += 1) {
    const date = shiftDate(today.year, today.month, today.day, start + index);
    moments.push(zonedInstant(date.year, date.month, date.day, hour, minute, timeZone));
  }
  return moments;
}

export function readOnLocalDate(completedAt: readonly string[], now: Date, timeZone: string): boolean {
  const today = localDateKey(now, timeZone);
  return completedAt.some((value) => {
    const time = Date.parse(value);
    return !Number.isNaN(time) && localDateKey(new Date(time), timeZone) === today;
  });
}

export function formatReminderTime(hour: number, minute: number): string {
  const date = new Date(2026, 0, 1, hour, minute, 0, 0);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date).replace(/\u202f/g, ' ');
}
