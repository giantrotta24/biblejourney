import { currentDay, DAY_COUNT, DAYS_PER_WEEK, days, WEEK_COUNT, weekDayIndexes, type PlanDay, type Progress } from "@/content/plan";
import { percentRead } from "./reading";

export type WeekState = "empty" | "partial" | "full";
export type ProgressStats = { percent: number; daysDone: number; versesLearned: number };

const FULL_WEEK = (1 << DAYS_PER_WEEK) - 1;

export function weekMask(done: ReadonlySet<number>, week: number): number {
  return weekDayIndexes(week).reduce((mask, index, position) => (done.has(index) ? mask | (1 << position) : mask), 0);
}

export function weekState(done: ReadonlySet<number>, week: number): WeekState {
  const mask = weekMask(done, week);
  return mask === 0 ? "empty" : mask === FULL_WEEK ? "full" : "partial";
}

export function isWeekComplete(done: ReadonlySet<number>, week: number): boolean {
  return weekMask(done, week) === FULL_WEEK;
}

export function currentWeek(done: ReadonlySet<number>): number | null {
  return currentDay(done)?.week ?? null;
}

export function currentEraIndex(done: ReadonlySet<number>, eras: ReadonlyArray<{ weeks: readonly [number, number] }>): number {
  const week = currentWeek(done);
  if (week === null) return eras.length - 1;
  return Math.max(0, eras.findLastIndex((era) => era.weeks[0] <= week));
}

export function progressStats(progress: Progress): ProgressStats {
  return {
    percent: percentRead(progress.days, days),
    daysDone: progress.days.size,
    versesLearned: progress.verses.size,
  };
}

export function unlockedWeeks(done: ReadonlySet<number>): number[] {
  const through = currentWeek(done) ?? WEEK_COUNT;
  return Array.from({ length: through }, (_, i) => i + 1);
}

export function nextVerseWeek(pool: readonly number[], shown: number, random: () => number = Math.random): number {
  const choices = pool.filter((week) => week !== shown);
  if (choices.length === 0) return shown;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

export function sundayWeek(done: ReadonlySet<number>, seen: number | null): number | null {
  if (done.size === 0 || done.size >= DAY_COUNT) return null;
  const furthest = Math.max(...done);
  if (furthest % DAYS_PER_WEEK !== DAYS_PER_WEEK - 1) return null;
  const week = Math.floor(furthest / DAYS_PER_WEEK) + 1;
  if (!isWeekComplete(done, week)) return null;
  if (seen !== null && seen >= week) return null;
  return week;
}

export function catchUpDays(done: ReadonlySet<number>, throughWeek: number): PlanDay[] {
  return days.filter((day) => day.week <= throughWeek && !done.has(day.index));
}
