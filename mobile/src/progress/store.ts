import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadDocument, saveDocument, type KeyValueStore } from '@/persist/document';
import { DAY_COUNT } from '../../../supabase/functions/_shared/content/plan';

export type { KeyValueStore } from '@/persist/document';

export const PROGRESS_KEY = 'biblejourney.progress.v1';
export const UNREADABLE_KEY = 'biblejourney.progress.v1.unreadable';
const PROGRESS_VERSION = 1;

export type LoadedProgress =
  | { status: 'empty' }
  | { status: 'ready'; days: Set<number> }
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

function serialize(days: ReadonlySet<number>): string {
  return JSON.stringify({ version: PROGRESS_VERSION, days: [...days].sort((a, b) => a - b) });
}

export async function loadProgress(storage: KeyValueStore = AsyncStorage): Promise<LoadedProgress> {
  const loaded = await loadDocument(storage, PROGRESS_KEY, documentDays);
  if (loaded.status === 'ready') return { status: 'ready', days: loaded.value };
  return loaded;
}

export async function saveProgress(
  days: ReadonlySet<number>,
  storage: KeyValueStore = AsyncStorage,
  backupRaw?: string | null,
): Promise<void> {
  await saveDocument(storage, PROGRESS_KEY, serialize(days), UNREADABLE_KEY, backupRaw);
}
