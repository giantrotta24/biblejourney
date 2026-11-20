import { describe, expect, it } from '@jest/globals';

import {
  PROGRESS_KEY,
  PROGRESS_V2_KEY,
  loadProgress,
  parseProgress,
  saveProgress,
  type KeyValueStore,
} from './store';

function memory(initial?: string): KeyValueStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  if (initial !== undefined) raw.set(PROGRESS_KEY, initial);
  return {
    raw,
    async getItem(key) {
      return raw.get(key) ?? null;
    },
    async setItem(key, value) {
      raw.set(key, value);
    },
  };
}

describe('parseProgress', () => {
  it('treats missing data as nothing read', () => {
    expect(parseProgress(null)).toEqual(new Set());
  });

  it('drops corrupt payloads', () => {
    expect(parseProgress('not json')).toEqual(new Set());
    expect(parseProgress('{}')).toEqual(new Set());
    expect(parseProgress('{"version":2,"days":[0]}')).toEqual(new Set());
    expect(parseProgress('{"version":1,"days":"nope"}')).toEqual(new Set());
    expect(parseProgress('{"version":1}')).toEqual(new Set());
  });

  it('keeps only real day indexes', () => {
    expect(parseProgress('{"version":1,"days":[0,1.5,-1,312,"3",2,2]}')).toEqual(new Set([0, 2]));
  });
});

describe('progress store', () => {
  it('loads an empty result when nothing is stored', async () => {
    await expect(loadProgress(memory())).resolves.toEqual({ status: 'empty' });
  });

  it('reports a read failure instead of an empty year', async () => {
    const storage: KeyValueStore = {
      async getItem() {
        throw new Error('unavailable');
      },
      async setItem() {
        throw new Error('unavailable');
      },
    };
    await expect(loadProgress(storage)).resolves.toEqual({ status: 'unavailable' });
  });

  it('reports a stored payload that cannot be parsed', async () => {
    const storage = memory('{"version":1');
    await expect(loadProgress(storage)).resolves.toEqual({ status: 'unreadable', raw: '{"version":1' });
  });

  it('loads the days that were stored', async () => {
    const storage = memory(JSON.stringify({ version: 1, days: [4, 1, 1] }));
    const loaded = await loadProgress(storage);
    expect(loaded.status).toBe('ready');
    if (loaded.status !== 'ready') return;
    expect(loaded.rows.map((row) => row.day_index)).toEqual([1, 4]);
  });

  it('saves rows in day order and reads them back', async () => {
    const storage = memory();
    await saveProgress(
      [
        { day_index: 4, completed_at: '2026-11-20T15:00:00.000Z' },
        { day_index: 1, completed_at: '2026-11-20T15:00:00.000Z' },
      ],
      storage,
    );
    expect(JSON.parse(storage.raw.get(PROGRESS_V2_KEY) ?? '').rows).toEqual([
      { day_index: 1, completed_at: '2026-11-20T15:00:00.000Z' },
      { day_index: 4, completed_at: '2026-11-20T15:00:00.000Z' },
    ]);
    const loaded = await loadProgress(storage);
    expect(loaded.status).toBe('ready');
    if (loaded.status !== 'ready') return;
    expect(loaded.rows.map((row) => row.day_index)).toEqual([1, 4]);
  });

  it('migrates a v1 set of days into timestamped rows and keeps the v1 value', async () => {
    const v1 = JSON.stringify({ version: 1, days: [4, 1, 1] });
    const storage = memory(v1);
    const at = new Date('2026-11-20T15:00:00.000Z');
    await expect(loadProgress(storage, () => at)).resolves.toEqual({
      status: 'ready',
      rows: [
        { day_index: 1, completed_at: '2026-11-20T15:00:00.000Z' },
        { day_index: 4, completed_at: '2026-11-20T15:00:00.000Z' },
      ],
    });
    expect(storage.raw.get(PROGRESS_KEY)).toBe(v1);
    expect(storage.raw.has('biblejourney.progress.v1.backup')).toBe(false);
    const saved = JSON.parse(storage.raw.get(PROGRESS_V2_KEY) ?? '');
    expect(saved.rows.map((row: { day_index: number }) => row.day_index)).toEqual([1, 4]);
  });

  it('ignores v1 once v2 is stored', async () => {
    const storage = memory(JSON.stringify({ version: 1, days: [1] }));
    await saveProgress([{ day_index: 4, completed_at: '2026-11-20T15:00:00.000Z' }], storage);
    await expect(loadProgress(storage)).resolves.toEqual({
      status: 'ready',
      rows: [{ day_index: 4, completed_at: '2026-11-20T15:00:00.000Z' }],
    });
  });

  it('does not migrate a corrupt v1 into an empty year', async () => {
    const corrupt = '{"version":1';
    const storage = memory(corrupt);
    await expect(loadProgress(storage)).resolves.toEqual({ status: 'unreadable', raw: corrupt });
    expect(storage.raw.has(PROGRESS_V2_KEY)).toBe(false);
    expect(storage.raw.get(PROGRESS_KEY)).toBe(corrupt);
  });
});
