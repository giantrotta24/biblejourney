import type { DayRow } from '@/progress/store';
import type { NoteRow } from '@/notes/store';
import type { VerseRow } from '@/verses/store';

function byDay(a: { day_index: number }, b: { day_index: number }) {
  return a.day_index - b.day_index;
}

function byWeek(a: VerseRow, b: VerseRow) {
  return a.week - b.week;
}

/** Earliest completion wins. A day that exists on only one side is kept. */
export function mergeDays(local: readonly DayRow[], incoming: readonly DayRow[]): DayRow[] {
  const map = new Map(local.map((row) => [row.day_index, row]));
  for (const row of incoming) {
    const existing = map.get(row.day_index);
    if (existing && existing.completed_at <= row.completed_at) continue;
    map.set(row.day_index, row);
  }
  return [...map.values()].sort(byDay);
}

/** Earliest learned time wins. A week that exists on only one side is kept. */
export function mergeVerses(local: readonly VerseRow[], incoming: readonly VerseRow[]): VerseRow[] {
  const map = new Map(local.map((row) => [row.week, row]));
  for (const row of incoming) {
    const existing = map.get(row.week);
    if (existing && existing.learned_at <= row.learned_at) continue;
    map.set(row.week, row);
  }
  return [...map.values()].sort(byWeek);
}

/** Latest edit wins. A note that exists on only one side is kept. */
export function mergeNotes(local: readonly NoteRow[], incoming: readonly NoteRow[]): NoteRow[] {
  const map = new Map(local.map((row) => [row.day_index, row]));
  for (const row of incoming) {
    const existing = map.get(row.day_index);
    if (existing && existing.updated_at > row.updated_at) continue;
    map.set(row.day_index, row);
  }
  return [...map.values()].sort(byDay);
}

export function sameDays(a: readonly DayRow[], b: readonly DayRow[]): boolean {
  return a.length === b.length && a.every((row, index) => row.day_index === b[index]?.day_index && row.completed_at === b[index]?.completed_at);
}

export function sameVerses(a: readonly VerseRow[], b: readonly VerseRow[]): boolean {
  return a.length === b.length && a.every((row, index) => row.week === b[index]?.week && row.learned_at === b[index]?.learned_at);
}

export function sameNotes(a: readonly NoteRow[], b: readonly NoteRow[]): boolean {
  return (
    a.length === b.length &&
    a.every((row, index) => row.day_index === b[index]?.day_index && row.body === b[index]?.body && row.updated_at === b[index]?.updated_at)
  );
}
