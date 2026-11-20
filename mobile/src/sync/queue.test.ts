import { describe, expect, it } from '@jest/globals';

import type { KeyValueStore } from '@/persist/document';

import { createStorageQueue } from './queue';

function memory(): KeyValueStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
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

describe('sync queue', () => {
  it('keeps pending changes across a restart, in order', async () => {
    const storage = memory();
    const queue = createStorageQueue(storage);
    await queue.push({
      kind: 'put-day',
      row: { day_index: 1, completed_at: '2026-11-20T12:00:00.000Z' },
      user_id: 'user-1',
    });
    await queue.push({ kind: 'delete-day', day_index: 0, user_id: 'user-1' });
    await queue.push({
      kind: 'put-note',
      row: { day_index: 2, body: 'Kept', updated_at: '2026-11-20T12:01:00.000Z' },
      user_id: 'user-1',
    });
    await queue.setLinkedUser('user-1');

    const reopened = createStorageQueue(storage);
    expect((await reopened.list('user-1')).map((op) => op.kind)).toEqual(['put-day', 'delete-day', 'put-note']);
    expect(await reopened.linkedUser()).toBe('user-1');
    expect(await reopened.list('someone-else')).toEqual([]);
  });

  it('does not replace a queue it could not read', async () => {
    const raw = new Map<string, string>();
    raw.set('biblejourney.sync.v1', '{"version":1}');
    const writes: string[] = [];
    const storage: KeyValueStore = {
      async getItem(key) {
        if (key === 'biblejourney.sync.v1') throw new Error('read');
        return raw.get(key) ?? null;
      },
      async setItem(key, value) {
        writes.push(key);
        raw.set(key, value);
      },
    };
    const queue = createStorageQueue(storage);
    await expect(queue.push({ kind: 'delete-verse', week: 1, user_id: 'user-1' })).rejects.toThrow('read');
    expect(writes).toEqual([]);
    expect(raw.get('biblejourney.sync.v1')).toBe('{"version":1}');
  });
});
