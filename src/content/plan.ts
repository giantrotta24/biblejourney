import raw from "../../content/bible-journey-seed.json";
import { DAYS_PER_WEEK, parseSeed, type Day, type Phase, type Week } from "./schema";

export type { Day, Era, People, Phase, Prophet, Week } from "./schema";
export { CHAPTER_COUNT, DAY_COUNT, DAYS_PER_WEEK, WEEK_COUNT } from "./schema";

const seed = parseSeed(raw);

export const phases: readonly Phase[] = seed.phases;
export const weeks: readonly Week[] = seed.weeks;
export const eras = seed.eras;
export const peoples = seed.peoples;
export const prophets = seed.prophets;

export type PlanDay = Day & { week: number; position: number };

export const days: readonly PlanDay[] = seed.weeks.flatMap((week) =>
  week.days.map((day, position) => ({ ...day, week: week.week, position })),
);

export const WEEKDAY_NAMES = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
} as const satisfies Record<Day["weekday"], string>;

export function getWeek(number: number): Week {
  const week = weeks[number - 1];
  if (!week) throw new RangeError(`No week ${number}`);
  return week;
}

export function getPhase(id: number): Phase {
  const phase = phases.find((p) => p.id === id);
  if (!phase) throw new RangeError(`No phase ${id}`);
  return phase;
}

export function weekDayIndexes(week: number): number[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, i) => (week - 1) * DAYS_PER_WEEK + i);
}

export type Progress = { days: ReadonlySet<number>; verses: ReadonlySet<number> };

export const EMPTY_PROGRESS: Progress = { days: new Set(), verses: new Set() };

export function currentDay(done: ReadonlySet<number>): PlanDay | null {
  return days.find((day) => !done.has(day.index)) ?? null;
}
