import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadDocument, saveDocument, type KeyValueStore } from '@/persist/document';
import { parseVersionedRows, serializeVersionedRows } from '@/persist/rows';
import { DAY_COUNT } from '../../../supabase/functions/_shared/content/plan';

export type { KeyValueStore } from '@/persist/document';

/** Legacy set of day indexes. Left in place as the backup of a migrated phone. */
export const PROGRESS_KEY = 'biblejourney.progress.v1';
export const PROGRESS_V2_KEY = 'biblejourney.progress.v2';
export const PROGRESS_V2_UNREADABLE_KEY = 'biblejourney.progress.v2.unreadable';
const PROGRESS_VERSION = 1;

export type DayRow = { day_index: number; completed_at: string };

export type LoadedProgress =
  | { status: 'empty' }
  | { status: 'ready'; rows: DayRow[] }
  | { status: 'unreadable'; raw: string }
  | { status: 'unavailable' };

export function parseProgress(raw: string | null, dayCount = DAY_COUNT): Set<number> {
  if (raw == null) return new Set();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return new Set();
  }
  if (!data || typeof data !== 'object') return new Set();
  const record = data as { version?: unknown; days?: unknown };
  if (record.version !== PROGRESS_VERSION || !Array.isArray(record.days)) return new Set();
  const days = new Set<number>();
  for (const value of record.days) {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < dayCount) {
      days.add(value);
    }
  }
  return days;
}

function documentDays(raw: string): Set<number> | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const record = data as { version?: unknown; days?: unknown };
  if (record.version !== PROGRESS_VERSION || !Array.isArray(record.days)) return null;
  return parseProgress(raw);
}

function isDay(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < DAY_COUNT;
}

function dayRow(value: unknown): DayRow | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as { day_index?: unknown; completed_at?: unknown };
  if (typeof row.day_index !== 'number' || !isDay(row.day_index)) return null;
  if (typeof row.completed_at !== 'string' || Number.isNaN(Date.parse(row.completed_at))) return null;
  return { day_index: row.day_index, completed_at: row.completed_at };
}

function earlier(current: DayRow, candidate: DayRow): DayRow {
  return candidate.completed_at < current.completed_at ? candidate : current;
}

export function parseDayRows(raw: string): DayRow[] | null {
  const rows = parseVersionedRows(raw);
  if (rows == null) return null;
  const byDay = new Map<number, DayRow>();
  for (const value of rows) {
    const row = dayRow(value);
    if (!row) continue;
    const existing = byDay.get(row.day_index);
    byDay.set(row.day_index, existing ? earlier(existing, row) : row);
  }
  return [...byDay.values()].sort((a, b) => a.day_index - b.day_index);
}

async function readRaw(
  storage: KeyValueStore,
  key: string,
): Promise<{ status: 'unavailable' } | { status: 'ok'; raw: string | null }> {
  try {
    return { status: 'ok', raw: await storage.getItem(key) };
  } catch {
    return { status: 'unavailable' };
  }
}

/**
 * v1 is read only when v2 is missing. After that write, v1 stays as a backup and is not
 * merged again, so a day removed on another device is not restored from it.
 */
export async function loadProgress(
  storage: KeyValueStore = AsyncStorage,
  now: () => Date = () => new Date(),
): Promise<LoadedProgress> {
  const v2 = await loadDocument(storage, PROGRESS_V2_KEY, parseDayRows);
  if (v2.status === 'unavailable' || v2.status === 'unreadable') return v2;
  if (v2.status === 'ready') return { status: 'ready', rows: v2.value };

  const v1 = await readRaw(storage, PROGRESS_KEY);
  if (v1.status === 'unavailable') return { status: 'unavailable' };
  if (v1.raw == null) return { status: 'empty' };
  const days = documentDays(v1.raw);
  if (days == null) return { status: 'unreadable', raw: v1.raw };
  if (days.size === 0) return { status: 'empty' };

  const completed_at = now().toISOString();
  const rows = [...days].sort((a, b) => a - b).map((day_index) => ({ day_index, completed_at }));
  try {
    await saveProgress(rows, storage);
  } catch {
    return { status: 'unavailable' };
  }
  return { status: 'ready', rows };
}

export async function saveProgress(
  rows: readonly DayRow[],
  storage: KeyValueStore = AsyncStorage,
  backupRaw?: string | null,
): Promise<void> {
  const ordered = [...rows].sort((a, b) => a.day_index - b.day_index);
  await saveDocument(storage, PROGRESS_V2_KEY, serializeVersionedRows(ordered), PROGRESS_V2_UNREADABLE_KEY, backupRaw);
}
