import type { NoteRow } from './store';

export type { NoteRow } from './store';

export function matchingNotes(
  rows: readonly NoteRow[],
  query: string,
  reading: (dayIndex: number) => string,
): NoteRow[] {
  const ordered = [...rows].sort((a, b) => {
    if (a.updated_at === b.updated_at) return b.day_index - a.day_index;
    return a.updated_at < b.updated_at ? 1 : -1;
  });
  const needle = query.trim().toLowerCase();
  if (!needle) return ordered;
  return ordered.filter((row) => {
    const haystack = `${row.body}\n${reading(row.day_index)}`.toLowerCase();
    return haystack.includes(needle);
  });
}
