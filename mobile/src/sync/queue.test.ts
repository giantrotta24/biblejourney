import { describe, expect, it } from '@jest/globals';

import type { KeyValueStore } from '@/persist/document';

import { createStorageQueue, memoryQueue } from './queue';

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

  it('keeps the latest change for a row and leaves a reset where it was', async () => {
    const queue = memoryQueue();
    await queue.push({
      kind: 'put-note',
      row: { day_index: 2, body: 'first', updated_at: '2026-11-20T12:00:00.000Z' },
      user_id: 'user-1',
    });
    await queue.push({ kind: 'mark-reset', at: '2026-11-20T12:01:00.000Z', user_id: 'user-1' });
    await queue.push({
      kind: 'put-note',
      row: { day_index: 2, body: 'second', updated_at: '2026-11-20T12:02:00.000Z' },
      user_id: 'user-1',
    });
    await queue.push({ kind: 'mark-reset', at: '2026-11-20T12:03:00.000Z', user_id: 'user-1' });
    expect((await queue.list('user-1')).map((op) => op.kind)).toEqual(['mark-reset', 'put-note', 'mark-reset']);
    const note = (await queue.list('user-1')).find((op) => op.kind === 'put-note');
    expect(note && note.kind === 'put-note' ? note.row.body : null).toBe('second');
  });

  it('retries a read that threw and stops after a payload it cannot parse', async () => {
    let reads = 0;
    const storage: KeyValueStore = {
      async getItem() {
        reads += 1;
        if (reads === 1) throw new Error('read');
        return null;
      },
      async setItem() {
        return undefined;
      },
    };
    const queue = createStorageQueue(storage);
    await expect(queue.list('user-1')).rejects.toThrow('read');
    await expect(queue.list('user-1')).resolves.toEqual([]);

    const stuck = createStorageQueue({
      async getItem() {
        return '{"version":1}';
      },
      async setItem() {
        throw new Error('wrote over a bad queue');
      },
    });
    await expect(stuck.push({ kind: 'delete-verse', week: 1, user_id: 'user-1' })).rejects.toThrow(
      'Sync queue could not be read',
    );
    await expect(stuck.list('user-1')).rejects.toThrow('Sync queue could not be read');
  });
});
