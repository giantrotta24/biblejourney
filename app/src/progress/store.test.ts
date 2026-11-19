import { describe, expect, it } from '@jest/globals';

import {
  PROGRESS_KEY,
  loadProgress,
  markDay,
  parseProgress,
  saveProgress,
  unmarkDay,
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
  it('loads an empty set when nothing is stored', async () => {
    await expect(loadProgress(memory())).resolves.toEqual(new Set());
  });

  it('loads an empty set when storage throws', async () => {
    const storage: KeyValueStore = {
      async getItem() {
        throw new Error('unavailable');
      },
      async setItem() {
        throw new Error('unavailable');
      },
    };
    await expect(loadProgress(storage)).resolves.toEqual(new Set());
  });

  it('saves, marks, and unmarks', async () => {
    const storage = memory();
    await saveProgress(new Set([1]), storage);
    expect(JSON.parse(storage.raw.get(PROGRESS_KEY) ?? '')).toEqual({ version: 1, days: [1] });

    const marked = await markDay(4, storage);
    expect(marked).toEqual(new Set([1, 4]));
    await expect(loadProgress(storage)).resolves.toEqual(new Set([1, 4]));

    const unmarked = await unmarkDay(1, storage);
    expect(unmarked).toEqual(new Set([4]));
    await expect(loadProgress(storage)).resolves.toEqual(new Set([4]));
  });

  it('does not store an index outside the plan', async () => {
    const storage = memory();
    await expect(markDay(312, storage)).resolves.toEqual(new Set());
    await expect(markDay(-1, storage)).resolves.toEqual(new Set());
    expect(storage.raw.get(PROGRESS_KEY)).toBe(JSON.stringify({ version: 1, days: [] }));
  });
});
