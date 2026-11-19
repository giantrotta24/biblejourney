export type EraSpan = {
  title: string;
  summary: string;
  weeks: readonly [number, number];
};

/** The era that contains `week`. A week on a shared boundary belongs to the later era. */
export function eraForWeek<T extends EraSpan>(week: number, list: readonly T[]): T {
  let match: T | undefined;
  for (const era of list) {
    if (week < era.weeks[0] || week > era.weeks[1]) continue;
    if (!match || era.weeks[0] >= match.weeks[0]) match = era;
  }
  if (!match) throw new RangeError(`No era covers week ${week}`);
  return match;
}
