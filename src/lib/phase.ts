export function weekRangeLabel([first, last]: readonly [number, number]): string {
  return first === last ? `Week ${first}` : `Weeks ${first}–${last}`;
}

export function weekAnchor(week: number): string {
  return `week-${week}`;
}
