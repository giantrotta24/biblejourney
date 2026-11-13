import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { localPersistence } from "@/progress/persistence";
import type { DayRow } from "@/progress/rows";
import { createProgressStore } from "@/progress/store";
import { createProgressSync } from "./engine";
import { createFakeServer, type FakeDevice } from "./fake-remote";
import { localQueue } from "./queue";

const USER = "user-1";
const at = (minute: number) => new Date(Date.UTC(2026, 10, 13, 12, minute)).toISOString();

function clock(start = 0) {
  let minute = start;
  return () => new Date(Date.UTC(2026, 10, 13, 12, minute++));
}

type Server = ReturnType<typeof createFakeServer>;

async function openDevice(server: Server, storage = new IDBFactory(), now = clock(100)) {
  const local = localPersistence(storage);
  const queue = localQueue(storage);
  const sync = createProgressSync(local, queue);
  const store = createProgressStore(sync.persistence, now);
  sync.attach(store);
  await store.load();
  const remote = server.device(USER);
  return { storage, local, queue, sync, store, remote };
}

type Device = Awaited<ReturnType<typeof openDevice>>;

async function settle(...devices: Device[]) {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.all(devices.map((device) => device.sync.idle()));
  }
}

const dayKeys = (device: Device) => [...device.store.getSnapshot().days].sort((a, b) => a - b);
const serverDays = (server: Server) => server.rows(USER).days.map((row) => row.day_index);

async function seed(remote: FakeDevice, days: DayRow[]) {
  await remote.putDays(days);
  remote.calls.length = 0;
}

describe("progress sync", () => {
  it("is a pass-through to the device while signed out", async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.store.addDay(0);
    await settle(device);
    expect(device.sync.getStatus()).toBe("off");
    expect(device.remote.calls).toEqual([]);
    expect((await device.local.load()).days.map((row) => row.day_index)).toEqual([0]);
  });

  it("merges a first sign-in as the union of both sets, keeping the earliest timestamp", async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.store.merge({
      days: [
        { day_index: 0, completed_at: at(10) },
        { day_index: 1, completed_at: at(30) },
        { day_index: 3, completed_at: at(5) },
      ],
      verses: [{ week: 1, learned_at: at(10) }],
    });
    await seed(device.remote, [
      { day_index: 1, completed_at: at(20) },
      { day_index: 2, completed_at: at(40) },
      { day_index: 3, completed_at: at(50) },
    ]);
    await device.remote.putVerses([{ week: 2, learned_at: at(15) }]);

    await device.sync.start(USER, device.remote);
    await settle(device);

    expect(dayKeys(device)).toEqual([0, 1, 2, 3]);
    expect([...device.store.getSnapshot().verses].sort()).toEqual([1, 2]);
    expect(device.store.rows().days.find((row) => row.day_index === 1)?.completed_at).toBe(at(20));
    expect(server.rows(USER).days).toEqual([
      { day_index: 0, completed_at: at(10) },
      { day_index: 1, completed_at: at(20) },
      { day_index: 2, completed_at: at(40) },
      { day_index: 3, completed_at: at(5) },
    ]);
    expect(server.rows(USER).verses.map((row) => row.week)).toEqual([1, 2]);
    expect((await device.local.load()).days.map((row) => row.day_index).sort()).toEqual([0, 1, 2, 3]);
    expect(device.sync.getStatus()).toBe("synced");
  });

  it("sends a tick as an insert and an untick as a delete, updating the device first", async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.sync.start(USER, device.remote);
    await settle(device);

    const ticking = device.store.addDay(4);
    expect(device.store.getSnapshot().days.has(4)).toBe(true);
    await ticking;
    await settle(device);
    expect(serverDays(server)).toEqual([4]);

    await device.store.addVerse(2);
    await device.store.removeDay(4);
    await settle(device);
    expect(serverDays(server)).toEqual([]);
    expect(server.rows(USER).verses.map((row) => row.week)).toEqual([2]);
  });

  it("queues changes in IndexedDB while offline and flushes them in order on reconnect", async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.sync.start(USER, device.remote);
    await settle(device);

    device.remote.online = false;
    await device.store.addDay(0);
    await device.store.addDay(1);
    await device.store.removeDay(0);
    await device.store.addVerse(3);
    await settle(device);

    expect(device.sync.getStatus()).toBe("offline");
    expect(dayKeys(device)).toEqual([1]);
    expect(serverDays(server)).toEqual([]);
    const queued = await localQueue(device.storage).list(USER);
    expect(queued.map((op) => op.kind)).toEqual(["put-day", "put-day", "delete-day", "put-verse"]);

    device.remote.online = true;
    device.remote.calls.length = 0;
    await device.sync.resync();
    await settle(device);

    expect(device.remote.calls.filter((call) => call !== "pull")).toEqual(["putDays", "putDays", "deleteDay", "putVerses"]);
    expect(serverDays(server)).toEqual([1]);
    expect(server.rows(USER).verses.map((row) => row.week)).toEqual([3]);
    expect(await localQueue(device.storage).list(USER)).toEqual([]);
    expect(device.sync.getStatus()).toBe("synced");
  });

  it("flushes a queue left from an earlier visit on the next sign-in", async () => {
    const server = createFakeServer();
    const first = await openDevice(server);
    await first.sync.start(USER, first.remote);
    await settle(first);
    first.remote.online = false;
    await first.store.addDay(9);
    await settle(first);
    expect(serverDays(server)).toEqual([]);

    const reopened = await openDevice(server, first.storage);
    expect(dayKeys(reopened)).toEqual([9]);
    await reopened.sync.start(USER, reopened.remote);
    await settle(reopened);
    expect(serverDays(server)).toEqual([9]);
  });

  it("does not let a stale pull bring back a day whose delete is still queued", async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await seed(device.remote, [{ day_index: 5, completed_at: at(1) }]);
    await device.sync.start(USER, device.remote);
    await settle(device);
    expect(dayKeys(device)).toEqual([5]);

    device.remote.failNext("deleteDay", 3);
    await device.store.removeDay(5);
    await settle(device);
    expect(serverDays(server)).toEqual([5]);

    await device.sync.resync();
    await settle(device);
    expect(device.remote.calls).toContain("pull");
    expect(dayKeys(device)).toEqual([]);

    await device.sync.flush();
    await settle(device);
    expect(serverDays(server)).toEqual([]);
    expect(dayKeys(device)).toEqual([]);
  });

  it("keeps both days when two devices tick different days at the same time", async () => {
    const server = createFakeServer();
    const phone = await openDevice(server);
    const laptop = await openDevice(server);
    await phone.sync.start(USER, phone.remote);
    await laptop.sync.start(USER, laptop.remote);
    await settle(phone, laptop);

    await Promise.all([phone.store.addDay(3), laptop.store.addDay(7)]);
    await settle(phone, laptop);

    expect(serverDays(server)).toEqual([3, 7]);
    expect(dayKeys(phone)).toEqual([3, 7]);
    expect(dayKeys(laptop)).toEqual([3, 7]);
  });

  it("applies inserts and deletes from another device to the store and IndexedDB", async () => {
    const server = createFakeServer();
    const phone = await openDevice(server);
    const laptop = await openDevice(server);
    await phone.sync.start(USER, phone.remote);
    await laptop.sync.start(USER, laptop.remote);
    await settle(phone, laptop);

    await phone.store.addDay(2);
    await phone.store.addVerse(1);
    await settle(phone, laptop);
    expect(dayKeys(laptop)).toEqual([2]);
    expect([...laptop.store.getSnapshot().verses]).toEqual([1]);
    expect((await laptop.local.load()).days.map((row) => row.day_index)).toEqual([2]);
    expect(laptop.remote.calls.filter((call) => call !== "pull")).toEqual([]);

    await phone.store.removeDay(2);
    await phone.store.removeVerse(1);
    await settle(phone, laptop);
    expect(dayKeys(laptop)).toEqual([]);
    expect(laptop.store.getSnapshot().verses.size).toBe(0);
    expect((await laptop.local.load()).days).toEqual([]);
    expect(laptop.remote.calls.filter((call) => call !== "pull")).toEqual([]);
  });

  it("keeps progress on the device and stops syncing after sign-out", async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.sync.start(USER, device.remote);
    await device.store.addDay(0);
    await settle(device);

    await device.sync.stop();
    expect(device.sync.getStatus()).toBe("off");
    await device.store.addDay(1);
    await settle(device);

    expect(dayKeys(device)).toEqual([0, 1]);
    expect(serverDays(server)).toEqual([0]);
    expect(await device.queue.list(USER)).toEqual([]);
  });

  it("follows the account on a restored session instead of re-adding days removed elsewhere", async () => {
    const server = createFakeServer();
    const laptop = await openDevice(server);
    await laptop.sync.start(USER, laptop.remote);
    await laptop.store.addDay(0);
    await laptop.store.addDay(1);
    await settle(laptop);
    laptop.remote.online = false;

    const phone = server.device(USER);
    await phone.deleteDay(1);

    const reopened = await openDevice(server, laptop.storage);
    expect(dayKeys(reopened)).toEqual([0, 1]);
    await reopened.sync.start(USER, reopened.remote);
    await settle(reopened);

    expect(serverDays(server)).toEqual([0]);
    expect(dayKeys(reopened)).toEqual([0]);
  });

  it("merges again as a union after signing out and back in", async () => {
    const server = createFakeServer();
    const device = await openDevice(server);
    await device.sync.start(USER, device.remote);
    await settle(device);
    await device.sync.stop();

    await device.store.addDay(6);
    await device.sync.start(USER, device.remote);
    await settle(device);
    expect(serverDays(server)).toEqual([6]);
  });
});
