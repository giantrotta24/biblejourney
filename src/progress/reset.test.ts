import { describe, expect, it } from "vitest";
import { createFakeServer } from "@/sync/fake-remote";
import { createProgressSync } from "@/sync/engine";
import { memoryQueue } from "@/sync/queue";
import { memoryPersistence } from "./persistence";
import { RESET_WORD, resetConfirmed, resetProgress } from "./reset";
import { createProgressStore } from "./store";

async function device() {
  const local = memoryPersistence();
  const sync = createProgressSync(local, memoryQueue());
  const store = createProgressStore(sync.persistence);
  sync.attach(store);
  await store.load();
  return { local, sync, store };
}

describe("resetConfirmed", () => {
  it("accepts only the confirmation word, ignoring case and surrounding space", () => {
    expect(RESET_WORD).toBe("RESET");
    expect(resetConfirmed("RESET")).toBe(true);
    expect(resetConfirmed("  reset ")).toBe(true);
    expect(resetConfirmed("")).toBe(false);
    expect(resetConfirmed("RESE")).toBe(false);
    expect(resetConfirmed("yes")).toBe(false);
  });
});

describe("resetProgress", () => {
  it("clears every day and verse on the device", async () => {
    const { store, local } = await device();
    await store.addDay(0);
    await store.addDay(1);
    await store.addVerse(1);
    await resetProgress(store);
    expect(store.getSnapshot().days.size).toBe(0);
    expect(store.getSnapshot().verses.size).toBe(0);
    expect(await local.load()).toEqual({ days: [], verses: [] });
  });

  it("clears the account too when signed in, through sync", async () => {
    const server = createFakeServer();
    const { store, sync } = await device();
    await sync.start("user-1", server.device("user-1"));
    await store.addDay(0);
    await store.addDay(5);
    await store.addVerse(2);
    await sync.idle();
    expect(server.rows("user-1").days).toHaveLength(2);

    await resetProgress(store);
    await sync.idle();
    expect(server.rows("user-1")).toEqual({ days: [], verses: [] });
  });
});
