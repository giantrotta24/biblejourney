import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadDocument, saveDocument, type KeyValueStore } from '@/persist/document';
import { parseVersionedRows, serializeVersionedRows } from '@/persist/rows';
import { DAY_COUNT } from '../../../supabase/functions/_shared/content/plan';

export type { KeyValueStore } from '@/persist/document';

export const NOTES_KEY = 'biblejourney.notes.v1';
export const NOTES_UNREADABLE_KEY = 'biblejourney.notes.v1.unreadable';

export type NoteRow = { day_index: number; body: string; updated_at: string };

export type LoadedNotes =
  | { status: 'empty' }
  | { status: 'ready'; value: NoteRow[] }
  | { status: 'unreadable'; raw: string }
  | { status: 'unavailable' };

function isDay(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < DAY_COUNT;
}

function noteRow(value: unknown): NoteRow | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as { day_index?: unknown; body?: unknown; updated_at?: unknown };
  if (!isDay(row.day_index as number)) return null;
  if (typeof row.body !== 'string' || row.body.length === 0) return null;
  if (typeof row.updated_at !== 'string' || Number.isNaN(Date.parse(row.updated_at))) return null;
  return { day_index: row.day_index as number, body: row.body, updated_at: row.updated_at };
}

function later(current: NoteRow, candidate: NoteRow): NoteRow {
  return candidate.updated_at > current.updated_at ? candidate : current;
}

export function parseNotes(raw: string): NoteRow[] | null {
  const rows = parseVersionedRows(raw);
  if (rows == null) return null;
  const byDay = new Map<number, NoteRow>();
  for (const value of rows) {
    const row = noteRow(value);
    if (!row) continue;
    const existing = byDay.get(row.day_index);
    byDay.set(row.day_index, existing ? later(existing, row) : row);
  }
  return [...byDay.values()].sort((a, b) => a.day_index - b.day_index);
}

export function withNote(rows: readonly NoteRow[], dayIndex: number, body: string, updatedAt = ''): NoteRow[] {
  if (!isDay(dayIndex)) return rows as NoteRow[];
  const existing = rows.find((row) => row.day_index === dayIndex);
  if (body.length === 0) {
    if (!existing) return rows as NoteRow[];
    return rows.filter((row) => row.day_index !== dayIndex);
  }
  if (existing && existing.body === body) return rows as NoteRow[];
  const next = { day_index: dayIndex, body, updated_at: updatedAt };
  return [...rows.filter((row) => row.day_index !== dayIndex), next].sort((a, b) => a.day_index - b.day_index);
}

export async function loadNotes(storage: KeyValueStore = AsyncStorage): Promise<LoadedNotes> {
  return loadDocument(storage, NOTES_KEY, parseNotes);
}

export async function saveNotes(
  rows: readonly NoteRow[],
  storage: KeyValueStore = AsyncStorage,
  backupRaw?: string | null,
): Promise<void> {
  const ordered = [...rows].sort((a, b) => a.day_index - b.day_index);
  await saveDocument(storage, NOTES_KEY, serializeVersionedRows(ordered), NOTES_UNREADABLE_KEY, backupRaw);
}
