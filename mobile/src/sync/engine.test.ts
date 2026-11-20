import { describe, expect, it, jest } from '@jest/globals';

import { createSync } from './engine';
import { createFakeServer, type FakeDevice } from './fake-remote';
import { createMemoryStore, type MemoryStore } from './memory-store';
import { createStorageQueue, memoryQueue, type PendingQueue } from './queue';
import type { KeyValueStore } from '@/persist/document';

const USER = 'user-1';
const at = (minute: number) => new Date(Date.UTC(2026, 10, 20, 12, minute)).toISOString();

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

function clock(start = 0) {
  let minute = start;
  return () => new Date(Date.UTC(2026, 10, 20, 12, minute++));
}

async function openDevice(server: ReturnType<typeof createFakeServer>, queue: PendingQueue = memoryQueue(), now = clock(100)) {
  const sync = createSync(queue, { debounceMs: 0 });
  const store = createMemoryStore(sync, now);
  sync.attach(store);
  await store.load();
  const remote = server.device(USER);
  return { sync, store, remote };
}

async function settle(...syncs: { idle(): Promise<void> }[]) {
  for (let round = 0; round < 8; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.all(syncs.map((sync) => sync.idle()));
  }
}

async function until(check: () => boolean) {
  for (let i = 0; i < 30 && !check(); i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  if (!check()) throw new Error('timed out');
}

const dayIndexes = (store: MemoryStore) => store.rows().days.map((row) => row.day_index);

describe('sync engine', () => {
  it('on a first link pulls the account and pushes rows the phone holds earlier', async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.store.mergeDays([
      { day_index: 0, completed_at: at(10) },
      { day_index: 1, completed_at: at(30) },
    ]);
    await device.store.mergeNotes([{ day_index: 4, body: 'on the phone', updated_at: at(30) }]);
    await device.remote.putDays([
      { day_index: 1, completed_at: at(20) },
      { day_index: 2, completed_at: at(40) },
    ]);
    await device.remote.putNotes([
      { day_index: 4, body: 'on the account', updated_at: at(10) },
      { day_index: 5, body: 'only there', updated_at: at(12) },
    ]);
    device.remote.calls.length = 0;

    await device.sync.start(USER, device.remote);
    await settle(device.sync);

    expect(dayIndexes(device.store)).toEqual([0, 1, 2]);
    expect(device.store.rows().days.find((row) => row.day_index === 1)?.completed_at).toBe(at(20));
    expect(server.rows(USER).days.map((row) => row.day_index)).toEqual([0, 1, 2]);
    expect(server.rows(USER).days.find((row) => row.day_index === 0)?.completed_at).toBe(at(10));
    expect(device.store.rows().notes.map((row) => row.body).sort()).toEqual(['on the phone', 'only there']);
    expect(server.rows(USER).notes.find((row) => row.day_index === 4)?.body).toBe('on the phone');
    expect(device.sync.getStatus()).toBe('synced');
  });

  it('drops rows removed on a linked phone and keeps a row a pending change holds', async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.sync.start(USER, device.remote);
    await device.store.addDay(0);
    await device.store.addDay(1);
    await settle(device.sync);

    device.remote.online = false;
    const other = server.device(USER);
    await other.deleteDay(0);
    device.remote.online = true;

    const release = device.remote.holdNextPull();
    const pulls = device.remote.calls.filter((call) => call === 'pull').length;
    const resync = device.sync.resync();
    await until(() => device.remote.calls.filter((call) => call === 'pull').length > pulls);
    await device.store.addDay(2);
    release();
    await resync;
    await settle(device.sync);

    expect(dayIndexes(device.store)).toEqual([1, 2]);
    expect(server.rows(USER).days.map((row) => row.day_index)).toEqual([1, 2]);
  });

  it('does not wipe a linked phone when the account pull is empty and nothing was reset', async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.sync.start(USER, device.remote);
    await device.store.addDay(0);
    await device.store.addNote(3, 'keep');
    await settle(device.sync);

    device.remote.online = false;
    const other = server.device(USER);
    await other.deleteDay(0);
    await other.deleteNote(3, '2099-01-01T00:00:00.000Z');
    device.remote.online = true;
    await device.sync.resync();
    await settle(device.sync);

    expect(dayIndexes(device.store)).toEqual([0]);
    expect(device.store.rows().notes.map((row) => row.body)).toEqual(['keep']);
    expect(device.sync.getStatus()).toBe('offline');
    await device.sync.stop();
  });

  it('clears progress and verses after a reset elsewhere and keeps notes', async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.sync.start(USER, device.remote);
    await device.store.addDay(0);
    await device.store.addVerse(1);
    await device.store.addNote(4, 'kept');
    await settle(device.sync);

    device.remote.online = false;
    const other: FakeDevice = server.device(USER);
    await other.markReset('2026-11-20T12:00:00.000Z');
    device.remote.online = true;
    await device.sync.resync();
    await settle(device.sync);

    expect(dayIndexes(device.store)).toEqual([]);
    expect(device.store.rows().verses).toEqual([]);
    expect(device.store.rows().notes.map((row) => row.body)).toEqual(['kept']);
    expect(server.rows(USER).notes.map((row) => row.body)).toEqual(['kept']);
    expect(device.sync.getStatus()).toBe('synced');
  });

  it('flushes a restarted queue in order', async () => {
    const server = createFakeServer();
    const storage = memory();
    const first = createStorageQueue(storage);
    await first.push({ kind: 'put-day', row: { day_index: 0, completed_at: at(1) }, user_id: USER });
    await first.push({ kind: 'put-day', row: { day_index: 1, completed_at: at(2) }, user_id: USER });
    await first.push({ kind: 'delete-day', day_index: 0, user_id: USER });
    await first.push({ kind: 'put-verse', row: { week: 3, learned_at: at(3) }, user_id: USER });
    await first.setLinkedUser(USER);

    const device = await openDevice(server, createStorageQueue(storage));
    await device.sync.start(USER, device.remote);
    await settle(device.sync);

    expect(device.remote.calls.filter((call) => call !== 'pull')).toEqual(['putDays', 'deleteDay', 'putVerses']);
    expect(server.rows(USER).days.map((row) => row.day_index)).toEqual([1]);
    expect(server.rows(USER).verses.map((row) => row.week)).toEqual([3]);
    expect(await createStorageQueue(storage).list(USER)).toEqual([]);
  });

  it('drops a refused change, counts it, and sends the ones behind it', async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.sync.start(USER, device.remote);
    await settle(device.sync);

    device.remote.online = false;
    await device.store.addDay(3);
    await device.store.addDay(4);
    await device.store.addVerse(2);
    await settle(device.sync);

    device.remote.online = true;
    device.remote.refuseNext('putDays');
    await device.sync.resync();
    await settle(device.sync);

    expect(server.rows(USER).days.map((row) => row.day_index)).toEqual([4]);
    expect(server.rows(USER).verses.map((row) => row.week)).toEqual([2]);
    expect(device.sync.rejectedCount()).toBe(1);
    expect(device.sync.getStatus()).toBe('synced');
  });

  it('goes offline while the account cannot be reached and recovers', async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.sync.start(USER, device.remote);
    await settle(device.sync);

    device.remote.online = false;
    await device.store.addDay(6);
    await settle(device.sync);
    expect(device.sync.getStatus()).toBe('offline');
    expect(server.rows(USER).days).toEqual([]);
    expect(dayIndexes(device.store)).toEqual([6]);

    device.remote.online = true;
    await device.sync.resync();
    await settle(device.sync);
    expect(device.sync.getStatus()).toBe('synced');
    expect(server.rows(USER).days.map((row) => row.day_index)).toEqual([6]);
  });

  it('stops syncing on sign out and keeps what is on the phone', async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.sync.start(USER, device.remote);
    await device.store.addDay(0);
    await settle(device.sync);

    await device.sync.stop();
    expect(device.sync.getStatus()).toBe('off');
    await device.store.addDay(1);
    await settle(device.sync);

    expect(dayIndexes(device.store)).toEqual([0, 1]);
    expect(server.rows(USER).days.map((row) => row.day_index)).toEqual([0]);
    expect(device.sync.userId()).toBeNull();

    await device.sync.start(USER, device.remote);
    await settle(device.sync);
    expect(server.rows(USER).days.map((row) => row.day_index)).toEqual([0, 1]);
    expect(device.sync.getStatus()).toBe('synced');
  });

  it('keeps a note edited elsewhere after an older offline delete', async () => {
    const server = createFakeServer();
    let minute = 1;
    const device = await openDevice(server, memoryQueue(), () => new Date(Date.UTC(2026, 10, 20, 12, minute)));
    await device.sync.start(USER, device.remote);
    await device.store.addNote(3, 'original');
    await settle(device.sync);

    device.remote.online = false;
    minute = 2;
    await device.store.removeNote(3);
    await device.sync.recordLocal({ kind: 'delete-note', day_index: 3, deleted_at: at(2) });
    const other = server.device(USER);
    await other.putNotes([{ day_index: 3, body: 'edited elsewhere', updated_at: at(3) }]);
    device.remote.online = true;
    await device.sync.resync();
    await settle(device.sync);

    expect(device.store.rows().notes).toEqual([{ day_index: 3, body: 'edited elsewhere', updated_at: at(3) }]);
    expect(server.rows(USER).notes).toEqual([{ day_index: 3, body: 'edited elsewhere', updated_at: at(3) }]);
  });

  it('deletes the last note when another device deleted it and the account still has progress', async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.sync.start(USER, device.remote);
    await device.store.addDay(0);
    await device.store.addNote(3, 'deleted elsewhere');
    await settle(device.sync);

    const other = server.device(USER);
    await other.deleteNote(3, '2099-01-01T00:00:00.000Z');
    await device.sync.resync();
    await settle(device.sync);

    expect(device.store.rows().notes).toEqual([]);
    expect(dayIndexes(device.store)).toEqual([0]);
    expect(device.sync.getStatus()).toBe('synced');
    await device.sync.stop();
  });

  it('does not wipe notes when the whole account comes back empty', async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.sync.start(USER, device.remote);
    await device.store.addNote(3, 'keep');
    await settle(device.sync);

    device.remote.online = false;
    const other = server.device(USER);
    await other.deleteNote(3, '2099-01-01T00:00:00.000Z');
    device.remote.online = true;
    await device.sync.resync();
    await settle(device.sync);

    expect(device.store.rows().notes.map((row) => row.body)).toEqual(['keep']);
    expect(device.sync.getStatus()).toBe('offline');
    await device.sync.stop();
  });

  it('keeps a note whose put the account refused', async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.sync.start(USER, device.remote);
    await device.store.addNote(4, 'already there');
    await settle(device.sync);

    device.remote.refuseNext('putNotes');
    await device.store.addNote(3, 'stays on the phone');
    await settle(device.sync);
    await device.sync.resync();
    await settle(device.sync);

    expect(device.store.rows().notes.map((row) => row.body).sort()).toEqual(['already there', 'stays on the phone']);
    expect(server.rows(USER).notes.map((row) => row.body)).toEqual(['already there']);
    expect(device.sync.rejectedCount()).toBe(1);
  });

  it('does not send a debounced change after stop', async () => {
    jest.useFakeTimers();
    try {
      const server = createFakeServer();
      const sync = createSync(memoryQueue());
      const store = createMemoryStore(sync, clock(1));
      sync.attach(store);
      const remote = server.device(USER);
      await sync.start(USER, remote);
      await jest.advanceTimersByTimeAsync(0);
      await sync.idle();
      const calls = remote.calls.length;
      const recorded = store.addDay(7);
      await jest.advanceTimersByTimeAsync(0);
      await recorded;
      await sync.stop();
      await jest.advanceTimersByTimeAsync(5000);
      expect(remote.calls.length).toBe(calls);
      expect(server.rows(USER).days).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not keep deleting after stop', async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.sync.start(USER, device.remote);
    await device.store.addDay(0);
    await device.store.addDay(1);
    await settle(device.sync);

    device.remote.online = false;
    const other = server.device(USER);
    await other.deleteDay(0);
    await other.deleteDay(1);
    await other.putDays([{ day_index: 2, completed_at: at(9) }]);
    device.remote.online = true;

    const original = device.store.removeDay.bind(device.store);
    let stopped = false;
    device.store.removeDay = async (dayIndex) => {
      await original(dayIndex);
      if (!stopped) {
        stopped = true;
        await device.sync.stop();
      }
    };
    await device.sync.resync();
    await settle(device.sync);

    expect(dayIndexes(device.store)).toEqual([1]);
    expect(server.rows(USER).days.map((row) => row.day_index)).toEqual([2]);
  });

  it('keeps a row whose change has not reached the queue', async () => {
    const server = createFakeServer();
    const queue = memoryQueue();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const push = queue.push.bind(queue);
    let held = false;
    queue.push = async (op) => {
      if (!held && op.kind === 'put-day' && op.row.day_index === 0) {
        held = true;
        await gate;
      }
      await push(op);
    };
    const device = await openDevice(server, queue);
    await device.sync.start(USER, device.remote);
    await device.store.addDay(1);
    await settle(device.sync);

    const releasePull = device.remote.holdNextPull();
    const pending = device.store.addDay(0);
    await until(() => held);
    const pulls = device.remote.calls.filter((call) => call === 'pull').length;
    const resync = device.sync.resync();
    await until(() => device.remote.calls.filter((call) => call === 'pull').length > pulls);
    releasePull();
    await resync;
    expect(dayIndexes(device.store)).toEqual([0, 1]);
    release();
    await pending;
    await settle(device.sync);

    expect(dayIndexes(device.store)).toEqual([0, 1]);
    expect(server.rows(USER).days.map((row) => row.day_index)).toEqual([0, 1]);
  });

  it('pause keeps the phone linked', async () => {
    const server = createFakeServer();
    const queue = memoryQueue();
    const device = await openDevice(server, queue);
    await device.sync.start(USER, device.remote);
    await device.store.addDay(0);
    await settle(device.sync);

    device.sync.pause();
    expect(device.sync.userId()).toBeNull();
    expect(await queue.linkedUser()).toBe(USER);
    await device.sync.stop();
  });

  it('retries a stored change on the next flush', async () => {
    const server = createFakeServer();
    const storage = memory();
    let failWrites = false;
    const queueStorage = {
      async getItem(key: string) {
        return storage.getItem(key);
      },
      async setItem(key: string, value: string) {
        if (failWrites && key === 'biblejourney.sync.v1') throw new Error('disk');
        await storage.setItem(key, value);
      },
    };
    const device = await openDevice(server, createStorageQueue(queueStorage));
    device.sync.attach(device.store);
    const sync = createSync(createStorageQueue(queueStorage), { debounceMs: 0, unrecordedStore: storage });
    const store = createMemoryStore(sync, clock(4));
    sync.attach(store);
    const remote = server.device(USER);
    await sync.start(USER, remote);
    await settle(sync);
    failWrites = true;
    await expect(store.addDay(8)).rejects.toThrow('disk');
    failWrites = false;
    await sync.flush();
    await settle(sync);
    expect(server.rows(USER).days.map((row) => row.day_index)).toEqual([8]);
    expect(store.rows().days.map((row) => row.day_index)).toEqual([8]);
  });

  it('does not write over a store that failed to load', async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.remote.putDays([{ day_index: 0, completed_at: at(1) }]);
    device.store.failNextLoad();
    await device.sync.start(USER, device.remote);
    await settle(device.sync);

    expect(server.rows(USER).days.map((row) => row.day_index)).toEqual([0]);
    expect(dayIndexes(device.store)).toEqual([]);
    expect(device.sync.getStatus()).toBe('offline');
    await device.sync.stop();
  });

  it('pulls again after the offline backoff', async () => {
    jest.useFakeTimers();
    try {
      const server = createFakeServer();
      const sync = createSync(memoryQueue());
      const store = createMemoryStore(sync, clock(1));
      sync.attach(store);
      const remote = server.device(USER);
      await sync.start(USER, remote);
      await jest.advanceTimersByTimeAsync(0);
      await sync.idle();
      remote.online = false;
      const recorded = store.addDay(6);
      await jest.advanceTimersByTimeAsync(1000);
      await recorded;
      await sync.idle();
      expect(sync.getStatus()).toBe('offline');
      const pulls = remote.calls.filter((call) => call === 'pull').length;
      remote.online = true;
      await jest.advanceTimersByTimeAsync(5000);
      await sync.idle();
      expect(remote.calls.filter((call) => call === 'pull').length).toBeGreaterThan(pulls);
      expect(sync.getStatus()).toBe('synced');
      await sync.stop();
    } finally {
      jest.useRealTimers();
    }
  });
});
