import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadDocument, saveDocument, type KeyValueStore } from '@/persist/document';
import { parseVersionedRows, serializeVersionedRows } from '@/persist/rows';
import { WEEK_COUNT } from '../../../supabase/functions/_shared/content/plan';

export type { KeyValueStore } from '@/persist/document';

export const VERSES_KEY = 'biblejourney.verses.v1';
export const VERSES_UNREADABLE_KEY = 'biblejourney.verses.v1.unreadable';

export type VerseRow = { week: number; learned_at: string };

export type LoadedVerses =
  | { status: 'empty' }
  | { status: 'ready'; value: VerseRow[] }
  | { status: 'unreadable'; raw: string }
  | { status: 'unavailable' };

function isWeek(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= WEEK_COUNT;
}

function verseRow(value: unknown): VerseRow | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as { week?: unknown; learned_at?: unknown };
  if (typeof row.week !== 'number' || !isWeek(row.week)) return null;
  if (typeof row.learned_at !== 'string' || Number.isNaN(Date.parse(row.learned_at))) return null;
  return { week: row.week, learned_at: row.learned_at };
}

function earlier(current: VerseRow, candidate: VerseRow): VerseRow {
  return candidate.learned_at < current.learned_at ? candidate : current;
}

export function parseVerses(raw: string): VerseRow[] | null {
  const rows = parseVersionedRows(raw);
  if (rows == null) return null;
  const byWeek = new Map<number, VerseRow>();
  for (const value of rows) {
    const row = verseRow(value);
    if (!row) continue;
    const existing = byWeek.get(row.week);
    byWeek.set(row.week, existing ? earlier(existing, row) : row);
  }
  return [...byWeek.values()].sort((a, b) => a.week - b.week);
}

export function withLearned(rows: readonly VerseRow[], week: number, learned: boolean, learnedAt = ''): VerseRow[] {
  if (!isWeek(week)) return rows as VerseRow[];
  const existing = rows.find((row) => row.week === week);
  if (learned) {
    if (existing) return rows as VerseRow[];
    return [...rows, { week, learned_at: learnedAt }].sort((a, b) => a.week - b.week);
  }
  if (!existing) return rows as VerseRow[];
  return rows.filter((row) => row.week !== week);
}

export async function loadVerses(storage: KeyValueStore = AsyncStorage): Promise<LoadedVerses> {
  return loadDocument(storage, VERSES_KEY, parseVerses);
}

export async function saveVerses(
  rows: readonly VerseRow[],
  storage: KeyValueStore = AsyncStorage,
  backupRaw?: string | null,
): Promise<void> {
  const ordered = [...rows].sort((a, b) => a.week - b.week);
  await saveDocument(storage, VERSES_KEY, serializeVersionedRows(ordered), VERSES_UNREADABLE_KEY, backupRaw);
}
