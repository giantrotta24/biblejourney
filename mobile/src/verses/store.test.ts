import { describe, expect, it } from '@jest/globals';

import {
  VERSES_KEY,
  VERSES_UNREADABLE_KEY,
  loadVerses,
  saveVerses,
  withLearned,
  type KeyValueStore,
  type VerseRow,
} from './store';

function memory(initial?: string): KeyValueStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  if (initial !== undefined) raw.set(VERSES_KEY, initial);
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

const row = (week: number, learned_at: string): VerseRow => ({ week, learned_at });

describe('known verses store', () => {
  it('loads an empty result when nothing is stored', async () => {
    await expect(loadVerses(memory())).resolves.toEqual({ status: 'empty' });
  });

  it('reports a read failure instead of no verses known', async () => {
    const storage: KeyValueStore = {
      async getItem() {
        throw new Error('unavailable');
      },
      async setItem() {
        throw new Error('unavailable');
      },
    };
    await expect(loadVerses(storage)).resolves.toEqual({ status: 'unavailable' });
  });

  it('reports a stored payload that cannot be parsed', async () => {
    const storage = memory('{"version":1');
    await expect(loadVerses(storage)).resolves.toEqual({ status: 'unreadable', raw: '{"version":1' });
  });

  it('keeps weeks 1 to 52 and the earliest learned time', async () => {
    const stored = JSON.stringify({
      version: 1,
      rows: [row(2, '2026-11-20T15:00:00.000Z'), row(0, '2026-11-20T12:00:00.000Z'), row(2, '2026-11-20T12:00:00.000Z'), row(53, '2026-11-20T12:00:00.000Z')],
    });
    await expect(loadVerses(memory(stored))).resolves.toEqual({
      status: 'ready',
      value: [row(2, '2026-11-20T12:00:00.000Z')],
    });
  });

  it('saves rows in week order and reads them back', async () => {
    const storage = memory();
    await saveVerses([row(4, '2026-11-20T12:00:00.000Z'), row(1, '2026-11-20T11:00:00.000Z')], storage);
    expect(JSON.parse(storage.raw.get(VERSES_KEY) ?? '')).toEqual({
      version: 1,
      rows: [row(1, '2026-11-20T11:00:00.000Z'), row(4, '2026-11-20T12:00:00.000Z')],
    });
  });

  it('copies unreadable verses aside before the first save', async () => {
    const storage = memory('{');
    await saveVerses([row(1, '2026-11-20T12:00:00.000Z')], storage, '{');
    expect(storage.raw.get(VERSES_UNREADABLE_KEY)).toBe('{');
  });
});

describe('withLearned', () => {
  const at = '2026-11-20T12:00:00.000Z';

  it('records a week once and clears it when it is no longer known', () => {
    const learned = withLearned([], 3, true, at);
    expect(learned).toEqual([row(3, at)]);
    expect(withLearned(learned, 3, true, '2026-11-21T12:00:00.000Z')).toBe(learned);
    expect(withLearned(learned, 3, false, '2026-11-21T12:00:00.000Z')).toEqual([]);
  });

  it('ignores a week outside 1 to 52', () => {
    expect(withLearned([], 0, true, at)).toEqual([]);
    expect(withLearned([], 53, true, at)).toEqual([]);
  });
});
