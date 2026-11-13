import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { localQueue, memoryQueue } from "./queue";

describe.each([
  ["IndexedDB", () => localQueue(new IDBFactory())],
  ["memory fallback", () => localQueue(null)],
  ["memory", () => memoryQueue()],
])("pending queue (%s)", (_, make) => {
  it("keeps each user's operations in the order they were queued", async () => {
    const queue = make();
    await queue.push({ user_id: "a", kind: "put-day", row: { day_index: 3, completed_at: "2026-11-13T12:00:00.000Z" } });
    await queue.push({ user_id: "b", kind: "delete-day", day_index: 1 });
    await queue.push({ user_id: "a", kind: "delete-day", day_index: 3 });
    await queue.push({ user_id: "a", kind: "put-verse", row: { week: 2, learned_at: "2026-11-13T12:01:00.000Z" } });

    const ops = await queue.list("a");
    expect(ops.map((op) => op.kind)).toEqual(["put-day", "delete-day", "put-verse"]);
    await queue.remove(ops[0].id);
    expect((await queue.list("a")).map((op) => op.kind)).toEqual(["delete-day", "put-verse"]);
    expect(await queue.list("b")).toHaveLength(1);
  });

  it("remembers which account this device's progress is linked to", async () => {
    const queue = make();
    expect(await queue.linkedUser()).toBeNull();
    await queue.setLinkedUser("a");
    expect(await queue.linkedUser()).toBe("a");
    await queue.setLinkedUser(null);
    expect(await queue.linkedUser()).toBeNull();
  });
});

it("keeps queued operations across reloads in IndexedDB", async () => {
  const storage = new IDBFactory();
  await localQueue(storage).push({ user_id: "a", kind: "delete-verse", week: 4 });
  await localQueue(storage).setLinkedUser("a");
  expect((await localQueue(storage).list("a")).map((op) => op.kind)).toEqual(["delete-verse"]);
  expect(await localQueue(storage).linkedUser()).toBe("a");
});
