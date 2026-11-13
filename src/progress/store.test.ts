import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { localPersistence, memoryPersistence } from "./persistence";
import { createProgressStore } from "./store";

function clock() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 10, 13, 12, 0, tick++));
}

async function freshStore(factory: IDBFactory | null = new IDBFactory()) {
  const store = createProgressStore(localPersistence(factory), clock());
  await store.load();
  return store;
}

describe("progress store", () => {
  it("is not ready until it loads", async () => {
    const store = createProgressStore(memoryPersistence(), clock());
    expect(store.getSnapshot().ready).toBe(false);
    await store.load();
    expect(store.getSnapshot()).toMatchObject({ ready: true });
    expect(store.getSnapshot().days.size).toBe(0);
  });

  it("updates the snapshot synchronously and notifies subscribers", async () => {
    const store = await freshStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.getSnapshot();
    void store.addDay(0);
    expect(store.getSnapshot()).not.toBe(before);
    expect(store.getSnapshot().days.has(0)).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    void store.addDay(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("persists ticks and unticks in IndexedDB across stores", async () => {
    const factory = new IDBFactory();
    const first = await freshStore(factory);
    await first.addDay(0);
    await first.addDay(1);
    await first.addDay(7);
    await first.removeDay(1);
    await first.addVerse(1);
    await first.addVerse(2);
    await first.removeVerse(2);

    const second = await freshStore(factory);
    expect([...second.getSnapshot().days].sort((a, b) => a - b)).toEqual([0, 7]);
    expect([...second.getSnapshot().verses]).toEqual([1]);
    expect(second.rows().days).toEqual([
      { day_index: 0, completed_at: "2026-11-13T12:00:00.000Z" },
      { day_index: 7, completed_at: "2026-11-13T12:00:02.000Z" },
    ]);
    expect(second.rows().verses).toEqual([{ week: 1, learned_at: "2026-11-13T12:00:03.000Z" }]);
  });

  it("keeps the first completion time when a day is ticked twice", async () => {
    const store = await freshStore();
    await store.addDay(3);
    await store.addDay(3);
    expect(store.rows().days).toEqual([{ day_index: 3, completed_at: "2026-11-13T12:00:00.000Z" }]);
  });

  it("does not notify when nothing changed", async () => {
    const store = await freshStore();
    const listener = vi.fn();
    store.subscribe(listener);
    await store.removeDay(5);
    await store.removeVerse(5);
    expect(listener).not.toHaveBeenCalled();
  });

  it("merges as a union of both sets, keeping the earliest timestamp", async () => {
    const factory = new IDBFactory();
    const store = await freshStore(factory);
    await store.addDay(0);
    await store.addDay(1);
    await store.merge({
      days: [
        { day_index: 1, completed_at: "2026-01-01T00:00:00.000Z" },
        { day_index: 2, completed_at: "2026-01-02T00:00:00.000Z" },
      ],
      verses: [{ week: 4, learned_at: "2026-01-03T00:00:00.000Z" }],
    });
    const reloaded = await freshStore(factory);
    expect(reloaded.rows().days).toEqual([
      { day_index: 0, completed_at: "2026-11-13T12:00:00.000Z" },
      { day_index: 1, completed_at: "2026-01-01T00:00:00.000Z" },
      { day_index: 2, completed_at: "2026-01-02T00:00:00.000Z" },
    ]);
    expect(reloaded.rows().verses).toEqual([{ week: 4, learned_at: "2026-01-03T00:00:00.000Z" }]);
  });

  it("rejects day indexes and weeks outside the plan", async () => {
    const store = await freshStore();
    await expect(store.addDay(312)).rejects.toThrow(RangeError);
    await expect(store.addDay(-1)).rejects.toThrow(RangeError);
    await expect(store.addVerse(0)).rejects.toThrow(RangeError);
    await expect(store.addVerse(53)).rejects.toThrow(RangeError);
    expect(store.getSnapshot().days.size).toBe(0);
  });

  it("falls back to memory when IndexedDB is missing", async () => {
    const store = await freshStore(null);
    await store.addDay(0);
    expect(store.getSnapshot()).toMatchObject({ ready: true });
    expect(store.getSnapshot().days.has(0)).toBe(true);
  });

  it("falls back to memory when IndexedDB refuses to open", async () => {
    const broken = {
      open() {
        throw new DOMException("A mutation operation was attempted on a database that did not allow mutations.", "InvalidStateError");
      },
    } as unknown as IDBFactory;
    const store = await freshStore(broken);
    await store.addVerse(3);
    expect(store.getSnapshot()).toMatchObject({ ready: true });
    expect(store.getSnapshot().verses.has(3)).toBe(true);
  });
});
