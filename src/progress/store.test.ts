import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { localPersistence, memoryPersistence } from "./persistence";
import type { ProgressPersistence } from "./rows";
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

  it("reports unsaved progress for a durable store only after a failed write", async () => {
    const store = await freshStore();
    expect(store.getSnapshot().saved).toBe(true);
    await store.addDay(0);
    expect(store.getSnapshot().saved).toBe(true);
  });

  it("reports progress as not saved when storage fell back to memory", async () => {
    const store = await freshStore(null);
    expect(store.getSnapshot().saved).toBe(false);
  });
});

function flaky() {
  const inner = memoryPersistence();
  const control = { failing: false };
  const guard = <A extends unknown[]>(fn: (...args: A) => Promise<void>) => async (...args: A) => {
    if (control.failing) throw new DOMException("QuotaExceededError", "QuotaExceededError");
    return fn(...args);
  };
  const persistence: ProgressPersistence = {
    load: () => inner.load(),
    putDays: guard(inner.putDays),
    deleteDay: guard(inner.deleteDay),
    putVerses: guard(inner.putVerses),
    deleteVerse: guard(inner.deleteVerse),
  };
  return { persistence, control, inner };
}

describe("failed writes", () => {
  it("keeps a failed insert, flags it unsaved, and retries it on the next write", async () => {
    const { persistence, control, inner } = flaky();
    const store = createProgressStore(persistence, clock());
    await store.load();
    control.failing = true;
    await store.addDay(0);
    expect(store.getSnapshot().saved).toBe(false);
    expect(store.getSnapshot().days.has(0)).toBe(true);

    control.failing = false;
    await store.addDay(1);
    expect(store.getSnapshot().saved).toBe(true);
    expect((await inner.load()).days.map((row) => row.day_index).sort()).toEqual([0, 1]);

    const reloaded = createProgressStore(persistence, clock());
    await reloaded.load();
    expect([...reloaded.getSnapshot().days].sort()).toEqual([0, 1]);
  });

  it("keeps a failed delete and replays it on flush", async () => {
    const { persistence, control, inner } = flaky();
    const store = createProgressStore(persistence, clock());
    await store.load();
    await store.addDay(4);
    await store.addVerse(2);
    control.failing = true;
    await store.removeDay(4);
    await store.removeVerse(2);
    expect(store.getSnapshot().saved).toBe(false);
    expect((await inner.load()).days).toHaveLength(1);

    control.failing = false;
    await store.flush();
    expect(store.getSnapshot().saved).toBe(true);
    expect(await inner.load()).toEqual({ days: [], verses: [] });
  });

  it("keeps only the latest intent for a day that was ticked then unticked while failing", async () => {
    const { persistence, control, inner } = flaky();
    const store = createProgressStore(persistence, clock());
    await store.load();
    control.failing = true;
    await store.addDay(9);
    await store.removeDay(9);
    control.failing = false;
    await store.flush();
    expect((await inner.load()).days).toEqual([]);
    expect(store.getSnapshot().saved).toBe(true);
  });

  it("retries on load when something is still pending", async () => {
    const { persistence, control } = flaky();
    const store = createProgressStore(persistence, clock());
    control.failing = true;
    await store.addDay(2);
    control.failing = false;
    await store.load();
    expect(store.getSnapshot().saved).toBe(true);
  });
});

describe("IndexedDB connection", () => {
  it("closes on a version change so an upgrade is never blocked", async () => {
    const factory = new IDBFactory();
    const persistence = localPersistence(factory);
    await persistence.load();
    const upgraded = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open("bible-journey", 2);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("blocked"));
    });
    upgraded.close();
    await expect(persistence.putDays([{ day_index: 0, completed_at: "2026-11-13T12:00:00.000Z" }])).rejects.toThrow();
  });
});
