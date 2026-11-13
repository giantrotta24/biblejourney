import { describe, expect, it } from "vitest";
import { forgetThisDevice, remindersOnHere, type DevicePush, type SubscriptionRows } from "./device";

function fakeRows(initial: [string, string][]) {
  const rows = new Set(initial.map(([user, endpoint]) => `${user} ${endpoint}`));
  const store: SubscriptionRows & { rows: Set<string>; failRemove: boolean } = {
    rows,
    failRemove: false,
    async has(userId, endpoint) {
      return rows.has(`${userId} ${endpoint}`);
    },
    async remove(userId, endpoint) {
      if (store.failRemove) throw new TypeError("Failed to fetch");
      rows.delete(`${userId} ${endpoint}`);
    },
  };
  return store;
}

function fakePush(endpoint: string) {
  const push: DevicePush & { unsubscribed: boolean } = {
    endpoint,
    unsubscribed: false,
    async unsubscribe() {
      push.unsubscribed = true;
      return true;
    },
  };
  return push;
}

const PHONE = "https://fcm.googleapis.com/fcm/send/phone";

describe("remindersOnHere", () => {
  it("is on only when this account has a row for this browser's exact endpoint and a reminder time", async () => {
    const rows = fakeRows([["alice", PHONE]]);
    expect(await remindersOnHere("alice", "07:00", fakePush(PHONE), rows)).toBe(true);
    expect(await remindersOnHere("alice", null, fakePush(PHONE), rows)).toBe(false);
    expect(await remindersOnHere("alice", "07:00", null, rows)).toBe(false);
  });

  it("is off for a second account on a browser whose subscription another account registered", async () => {
    const rows = fakeRows([["alice", PHONE]]);
    expect(await remindersOnHere("bob", "07:00", fakePush(PHONE), rows)).toBe(false);
  });
});

describe("forgetThisDevice", () => {
  it("removes the departing account's row for this endpoint and unsubscribes the browser", async () => {
    const rows = fakeRows([
      ["alice", PHONE],
      ["alice", "https://fcm.googleapis.com/fcm/send/laptop"],
    ]);
    const push = fakePush(PHONE);
    await forgetThisDevice("alice", push, rows);
    expect([...rows.rows]).toEqual(["alice https://fcm.googleapis.com/fcm/send/laptop"]);
    expect(push.unsubscribed).toBe(true);
  });

  it("still unsubscribes the browser when the row cannot be removed", async () => {
    const rows = fakeRows([["alice", PHONE]]);
    rows.failRemove = true;
    const push = fakePush(PHONE);
    await forgetThisDevice("alice", push, rows);
    expect(push.unsubscribed).toBe(true);
  });

  it("does nothing without a browser subscription", async () => {
    const rows = fakeRows([["alice", PHONE]]);
    await forgetThisDevice("alice", null, rows);
    expect(rows.rows.size).toBe(1);
  });
});
