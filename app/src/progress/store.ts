import AsyncStorage from '@react-native-async-storage/async-storage';

import { DAY_COUNT } from '../../../supabase/functions/_shared/content/plan';

export const PROGRESS_KEY = 'biblejourney.progress.v1';
const PROGRESS_VERSION = 1;

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

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

function serialize(days: ReadonlySet<number>): string {
  return JSON.stringify({ version: PROGRESS_VERSION, days: [...days].sort((a, b) => a - b) });
}

export async function loadProgress(storage: KeyValueStore = AsyncStorage): Promise<Set<number>> {
  try {
    return parseProgress(await storage.getItem(PROGRESS_KEY));
  } catch {
    return new Set();
  }
}

export async function saveProgress(days: ReadonlySet<number>, storage: KeyValueStore = AsyncStorage): Promise<void> {
  await storage.setItem(PROGRESS_KEY, serialize(days));
}

function change(days: ReadonlySet<number>, index: number, read: boolean): Set<number> {
  const next = new Set(days);
  if (!Number.isInteger(index) || index < 0 || index >= DAY_COUNT) return next;
  if (read) next.add(index);
  else next.delete(index);
  return next;
}

export async function markDay(index: number, storage: KeyValueStore = AsyncStorage): Promise<Set<number>> {
  const next = change(await loadProgress(storage), index, true);
  await saveProgress(next, storage);
  return next;
}

export async function unmarkDay(index: number, storage: KeyValueStore = AsyncStorage): Promise<Set<number>> {
  const next = change(await loadProgress(storage), index, false);
  await saveProgress(next, storage);
  return next;
}
