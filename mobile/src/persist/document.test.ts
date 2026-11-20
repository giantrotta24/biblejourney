import { describe, expect, it } from '@jest/globals';

import { loadDocument, saveDocument, type KeyValueStore } from './document';

function memory(initial?: Record<string, string>): KeyValueStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>(Object.entries(initial ?? {}));
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

describe('loadDocument', () => {
  it('reports nothing stored, a read error, and an unreadable payload as different results', async () => {
    await expect(loadDocument(memory(), 'notes', () => [])).resolves.toEqual({ status: 'empty' });

    const broken: KeyValueStore = {
      async getItem() {
        throw new Error('unavailable');
      },
      async setItem() {
        throw new Error('unavailable');
      },
    };
    await expect(loadDocument(broken, 'notes', () => [])).resolves.toEqual({ status: 'unavailable' });

    const corrupt = memory({ notes: '{' });
    await expect(loadDocument(corrupt, 'notes', () => null)).resolves.toEqual({ status: 'unreadable', raw: '{' });
  });

  it('returns a parsed document when the payload is readable', async () => {
    const storage = memory({ notes: '[1]' });
    await expect(loadDocument(storage, 'notes', (raw) => JSON.parse(raw) as number[])).resolves.toEqual({
      status: 'ready',
      value: [1],
    });
  });
});

describe('saveDocument', () => {
  it('copies an unreadable payload aside once, then writes the new document', async () => {
    const storage = memory({ notes: '{', 'notes.unreadable': 'older' });
    await saveDocument(storage, 'notes', '[1]', 'notes.unreadable', '{');
    expect(storage.raw.get('notes.unreadable')).toBe('older');

    const fresh = memory({ notes: '{' });
    await saveDocument(fresh, 'notes', '[1]', 'notes.unreadable', '{');
    expect(fresh.raw.get('notes.unreadable')).toBe('{');
    expect(fresh.raw.get('notes')).toBe('[1]');
  });
});
