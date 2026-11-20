import { describe, expect, it } from '@jest/globals';

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
    await other.deleteNote(3);
    device.remote.online = true;
    await device.sync.resync();
    await settle(device.sync);

    expect(dayIndexes(device.store)).toEqual([0]);
    expect(device.store.rows().notes.map((row) => row.body)).toEqual(['keep']);
    expect(device.sync.getStatus()).toBe('offline');
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

    expect(device.remote.calls.filter((call) => call !== 'pull')).toEqual(['putDays', 'putDays', 'deleteDay', 'putVerses']);
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
  });
});
