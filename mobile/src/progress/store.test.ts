import { describe, expect, it } from '@jest/globals';

import { PROGRESS_KEY, loadProgress, parseProgress, saveProgress, type KeyValueStore } from './store';

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
    await expect(loadProgress(storage)).resolves.toEqual({ status: 'ready', days: new Set([1, 4]) });
  });

  it('saves days in order and reads them back', async () => {
    const storage = memory();
    await saveProgress(new Set([4, 1]), storage);
    expect(JSON.parse(storage.raw.get(PROGRESS_KEY) ?? '')).toEqual({ version: 1, days: [1, 4] });
    await expect(loadProgress(storage)).resolves.toEqual({ status: 'ready', days: new Set([1, 4]) });
  });
});
