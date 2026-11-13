import { describe, expect, it } from "vitest";
import { handleReminderRequest, type PushMessage, type ReminderDeps, type ReminderStore, type StoredSubscription } from "./send";

type Profile = { userId: string; timezone: string; reminderTime: string | null; lastRemindedOn: string | null };

function fakeStore(profiles: Profile[], subscriptions: Record<string, StoredSubscription[]>, days: Record<string, number[]> = {}) {
  const store: ReminderStore & { profiles: Profile[]; devices: Record<string, StoredSubscription[]> } = {
    profiles,
    devices: subscriptions,
    async candidates() {
      return profiles.filter((p) => p.reminderTime !== null).map((p) => ({ ...p }));
    },
    async claim(userId, date) {
      const profile = profiles.find((p) => p.userId === userId);
      if (!profile || (profile.lastRemindedOn !== null && profile.lastRemindedOn >= date)) return false;
      profile.lastRemindedOn = date;
      return true;
    },
    async subscriptions(userId) {
      return [...(subscriptions[userId] ?? [])];
    },
    async completedDays(userId) {
      return days[userId] ?? [];
    },
    async removeSubscription(userId, endpoint) {
      subscriptions[userId] = (subscriptions[userId] ?? []).filter((s) => s.endpoint !== endpoint);
    },
  };
  return store;
}

const sub = (endpoint: string): StoredSubscription => ({ endpoint, keys: { p256dh: "p", auth: "a" } });

function setup(options: { dead?: Record<string, number> } = {}) {
  const store = fakeStore(
    [
      { userId: "ny", timezone: "America/New_York", reminderTime: "07:00:00", lastRemindedOn: null },
      { userId: "tokyo", timezone: "Asia/Tokyo", reminderTime: "07:00:00", lastRemindedOn: null },
      { userId: "off", timezone: "America/New_York", reminderTime: null, lastRemindedOn: null },
    ],
    { ny: [sub("https://push.example/ny-phone"), sub("https://push.example/ny-laptop")], tokyo: [sub("https://push.example/tokyo")] },
    { ny: [0, 1] },
  );
  const sent: { endpoint: string; message: PushMessage }[] = [];
  const deps: ReminderDeps = {
    store,
    now: () => new Date("2026-06-01T11:05:00Z"),
    async push(subscription, message) {
      const status = options.dead?.[subscription.endpoint];
      if (status) throw Object.assign(new Error("gone"), { statusCode: status });
      sent.push({ endpoint: subscription.endpoint, message });
    },
  };
  return { store, sent, deps };
}

const request = (secret?: string) =>
  new Request("http://localhost/api/reminders/send", {
    method: "POST",
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  });

describe("POST /api/reminders/send", () => {
  it("answers 401 without the cron secret, or with the wrong one", async () => {
    const { deps, sent } = setup();
    expect((await handleReminderRequest(request(), "s3cret", () => deps)).status).toBe(401);
    expect((await handleReminderRequest(request("nope"), "s3cret", () => deps)).status).toBe(401);
    expect(sent).toEqual([]);
  });

  it("answers 401 when no cron secret is configured at all", async () => {
    const { deps } = setup();
    expect((await handleReminderRequest(request(""), undefined, () => deps)).status).toBe(401);
  });

  it("answers 503 when reminders are not set up on this copy", async () => {
    const response = await handleReminderRequest(request("s3cret"), "s3cret", () => null);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "not-configured" });
  });

  it("sends a calm reminder with the next reading to every device of a reader who is due", async () => {
    const { deps, sent, store } = setup();
    const response = await handleReminderRequest(request("s3cret"), "s3cret", () => deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", due: 1, sent: 2, removed: 0 });
    expect(sent.map((s) => s.endpoint)).toEqual(["https://push.example/ny-phone", "https://push.example/ny-laptop"]);
    expect(sent[0].message).toEqual({ title: "Today’s reading is ready", body: "Genesis 8–11", url: "/" });
    expect(store.profiles.find((p) => p.userId === "ny")?.lastRemindedOn).toBe("2026-06-01");
    expect(store.profiles.find((p) => p.userId === "tokyo")?.lastRemindedOn).toBeNull();
  });

  it("sends once however many times the job runs inside the window", async () => {
    const { deps, sent } = setup();
    await handleReminderRequest(request("s3cret"), "s3cret", () => deps);
    const again = await handleReminderRequest(request("s3cret"), "s3cret", () => ({ ...deps, now: () => new Date("2026-06-01T11:20:00Z") }));
    expect(await again.json()).toEqual({ status: "ok", due: 0, sent: 0, removed: 0 });
    expect(sent).toHaveLength(2);
  });

  it("sends once when two runs overlap", async () => {
    const { deps, sent } = setup();
    await Promise.all([
      handleReminderRequest(request("s3cret"), "s3cret", () => deps),
      handleReminderRequest(request("s3cret"), "s3cret", () => deps),
    ]);
    expect(sent).toHaveLength(2);
  });

  it("drops subscriptions the push service says are gone and keeps the rest", async () => {
    const { deps, sent, store } = setup({ dead: { "https://push.example/ny-phone": 410, "https://push.example/ny-laptop": 404 } });
    const response = await handleReminderRequest(request("s3cret"), "s3cret", () => deps);
    expect(await response.json()).toEqual({ status: "ok", due: 1, sent: 0, removed: 2 });
    expect(sent).toEqual([]);
    expect(store.devices.ny).toEqual([]);
    expect(store.devices.tokyo).toHaveLength(1);
  });

  it("keeps a subscription after a temporary push failure", async () => {
    const { deps, store } = setup({ dead: { "https://push.example/ny-phone": 500 } });
    const response = await handleReminderRequest(request("s3cret"), "s3cret", () => deps);
    expect(await response.json()).toEqual({ status: "ok", due: 1, sent: 1, removed: 0 });
    expect(store.devices.ny).toHaveLength(2);
  });

  it("does not use up the day's reminder for a reader with no devices", async () => {
    const { deps, store } = setup();
    store.devices.ny = [];
    await handleReminderRequest(request("s3cret"), "s3cret", () => deps);
    expect(store.profiles.find((p) => p.userId === "ny")?.lastRemindedOn).toBeNull();
  });

  it("sends nothing to a reader who has finished every reading", async () => {
    const { deps, sent, store } = setup();
    const all = Array.from({ length: 312 }, (_, i) => i);
    const finished = { ...deps, store: { ...store, completedDays: async () => all } };
    const response = await handleReminderRequest(request("s3cret"), "s3cret", () => finished);
    expect(await response.json()).toEqual({ status: "ok", due: 1, sent: 0, removed: 0 });
    expect(sent).toEqual([]);
  });
});
