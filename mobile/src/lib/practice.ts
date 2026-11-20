import { currentDay, WEEK_COUNT } from '../../../supabase/functions/_shared/content/plan';

/** Weeks 1 through the week of the current day. A finished year unlocks all 52. */
export function unlockedWeeks(done: ReadonlySet<number>): number[] {
  const through = currentDay(done)?.week ?? WEEK_COUNT;
  return Array.from({ length: through }, (_, index) => index + 1);
}

export function nextVerseWeek(pool: readonly number[], shown: number, random: () => number = Math.random): number {
  const choices = pool.filter((week) => week !== shown);
  if (choices.length === 0) return shown;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))] ?? shown;
}
