/** Geometry of the year grid in the mocks: 350 wide, a 6px gap after each phase but the last. */
const VIEW_WIDTH = 350;
const VIEW_GAP = 6;

export function gapsAfterPhases(list: readonly { weeks: readonly [number, number] }[]): number[] {
  return list.slice(0, -1).map((phase) => phase.weeks[1]);
}

function gapWidth(width: number): number {
  return (VIEW_GAP * width) / VIEW_WIDTH;
}

function columnWidth(width: number, gapsAfter: readonly number[], weekCount: number): number {
  return (width - gapsAfter.length * gapWidth(width)) / weekCount;
}

export function weekCenterX(
  week: number,
  width: number,
  gapsAfter: readonly number[],
  weekCount = 52,
): number {
  const gap = gapWidth(width);
  const column = columnWidth(width, gapsAfter, weekCount);
  const gapsBefore = gapsAfter.filter((end) => end < week).length;
  return (week - 1) * column + gapsBefore * gap + column / 2;
}

/** The week under an x position, in the same coordinate space as `width`. */
export function weekAtX(x: number, width: number, gapsAfter: readonly number[], weekCount = 52): number {
  if (!(width > 0)) return 1;
  const gap = gapWidth(width);
  const column = columnWidth(width, gapsAfter, weekCount);
  const clamped = Math.min(Math.max(x, 0), width);
  let cursor = 0;
  for (let week = 1; week <= weekCount; week++) {
    const columnEnd = cursor + column;
    const gapAfter = gapsAfter.includes(week) ? gap : 0;
    if (clamped <= columnEnd + gapAfter / 2 || week === weekCount) return week;
    cursor = columnEnd + gapAfter;
  }
  return weekCount;
}
