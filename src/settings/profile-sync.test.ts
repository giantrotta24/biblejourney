import { describe, expect, it } from "vitest";
import { createProfileSync } from "./profile-sync";
import { createSettingsStore, type KeyValueStorage, type ProfileFields, type ProfileRemote } from "./settings";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function flakyRemote(row: ProfileFields | null = null) {
  const remote: ProfileRemote & { saves: Partial<ProfileFields>[]; failSaves: number; failLoads: number } = {
    saves: [],
    failSaves: 0,
    failLoads: 0,
    async load() {
      if (remote.failLoads > 0) {
        remote.failLoads -= 1;
        throw new TypeError("Failed to fetch");
      }
      return row;
    },
    async save(fields) {
      if (remote.failSaves > 0) {
        remote.failSaves -= 1;
        throw new TypeError("Failed to fetch");
      }
      remote.saves.push(fields);
    },
  };
  return remote;
}

function setup() {
  const storage = memoryStorage();
  const store = createSettingsStore(storage);
  const sync = createProfileSync({ store, storage, timezone: () => "Europe/London", applyTheme: () => {} });
  const link = () => JSON.parse(storage.getItem("bible-journey:settings-link") ?? "null");
  return { storage, store, sync, link };
}

describe("profile sync", () => {
  it("retries a settings change that failed to upload once the connection is back", async () => {
    const { store, sync, link } = setup();
    const remote = flakyRemote();
    await sync.signedIn("u1", remote);
    remote.saves.length = 0;

    remote.failSaves = 1;
    store.update({ linkTranslation: "ESV" });
    await sync.changed();
    expect(remote.saves).toEqual([]);
    expect(link()).toEqual({ user: "u1", dirty: true });

    await sync.retry();
    expect(remote.saves).toEqual([{ theme: "system", link_translation: "ESV", timezone: "Europe/London" }]);
    expect(link()).toEqual({ user: "u1", dirty: false });

    await sync.retry();
    expect(remote.saves).toHaveLength(1);
  });

  it("retries on the next account callback for the same user", async () => {
    const { store, sync } = setup();
    const remote = flakyRemote();
    await sync.signedIn("u1", remote);
    remote.saves.length = 0;
    remote.failSaves = 1;
    store.update({ theme: "dark" });
    await sync.changed();
    await sync.signedIn("u1", remote);
    expect(remote.saves).toEqual([{ theme: "dark", link_translation: "NIV", timezone: "Europe/London" }]);
  });

  it("finishes a first sign-in whose upload failed when retried", async () => {
    const { store, sync, link } = setup();
    store.update({ theme: "light" });
    const remote = flakyRemote();
    remote.failSaves = 1;
    await sync.signedIn("u1", remote);
    expect(remote.saves).toEqual([]);
    await sync.retry();
    expect(remote.saves).toEqual([{ theme: "light", link_translation: "NIV", timezone: "Europe/London" }]);
    expect(link()).toEqual({ user: "u1", dirty: false });
  });

  it("does nothing on retry while signed out", async () => {
    const { sync } = setup();
    await expect(sync.retry()).resolves.toBeUndefined();
  });
});
