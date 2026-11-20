export type EraSpan = {
  title: string;
  summary: string;
  weeks: readonly [number, number];
};

/** The last era that has started by `week`. A shared boundary belongs to the later era. */
export function currentEraIndex<T extends { weeks: readonly [number, number] }>(week: number, list: readonly T[]): number {
  let index = 0;
  for (let i = 0; i < list.length; i += 1) {
    if (list[i].weeks[0] <= week) index = i;
  }
  return index;
}

export function weekRangeLabel([first, last]: readonly [number, number]): string {
  return first === last ? `Week ${first}` : `Weeks ${first}–${last}`;
}

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
