import { describe, expect, it } from "vitest";
import { bibleGatewayUrl } from "@/lib/reading";
import {
  DEFAULT_SETTINGS,
  createSettingsStore,
  parseSettings,
  reconcileProfile,
  THEME_COLORS,
  THEME_SCRIPT,
  TRANSLATIONS,
  type ProfileRemote,
  type ProfileFields,
} from "./settings";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("parseSettings", () => {
  it("defaults to the system theme, NIV links and a 7:00 reminder time", () => {
    expect(DEFAULT_SETTINGS).toEqual({ theme: "system", linkTranslation: "NIV", reminderTime: "07:00" });
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("not json")).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps each valid field and replaces only the broken ones", () => {
    expect(parseSettings(JSON.stringify({ theme: "dark", linkTranslation: "Klingon", reminderTime: "21:30" }))).toEqual({
      theme: "dark",
      linkTranslation: "NIV",
      reminderTime: "21:30",
    });
    expect(parseSettings(JSON.stringify({ theme: "sepia", linkTranslation: "ESV", reminderTime: "25:00" }))).toEqual({
      theme: "system",
      linkTranslation: "ESV",
      reminderTime: "07:00",
    });
  });

  it("offers the common Bible Gateway versions", () => {
    expect(TRANSLATIONS.map((t) => t.code)).toEqual(["NIV", "ESV", "NLT", "KJV", "NKJV", "CSB", "NRSVUE"]);
  });
});

describe("settings store", () => {
  it("persists changes and reads them back after a reload", () => {
    const storage = memoryStorage();
    const store = createSettingsStore(storage);
    store.update({ theme: "light", linkTranslation: "ESV" });
    expect(store.getSnapshot()).toEqual({ theme: "light", linkTranslation: "ESV", reminderTime: "07:00" });
    expect(createSettingsStore(storage).getSnapshot()).toEqual(store.getSnapshot());
  });

  it("tells subscribers about a change and ignores an invalid one", () => {
    const store = createSettingsStore(memoryStorage());
    let calls = 0;
    store.subscribe(() => calls++);
    store.update({ linkTranslation: "KJV" });
    store.update({ linkTranslation: "nope" as "KJV" });
    expect(calls).toBe(1);
    expect(store.getSnapshot().linkTranslation).toBe("KJV");
  });

  it("keeps working in memory when storage throws", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    };
    const store = createSettingsStore(broken);
    store.update({ theme: "dark" });
    expect(store.getSnapshot().theme).toBe("dark");
  });
});

describe("Read online links", () => {
  it("use the chosen translation", () => {
    const store = createSettingsStore(memoryStorage());
    expect(bibleGatewayUrl("Genesis 1–4", store.getSnapshot().linkTranslation)).toBe(bibleGatewayUrl("Genesis 1–4"));
    store.update({ linkTranslation: "NRSVUE" });
    const url = new URL(bibleGatewayUrl("Job 42; Genesis 12–15", store.getSnapshot().linkTranslation));
    expect(url.searchParams.get("version")).toBe("NRSVUE");
    expect(url.searchParams.get("search")).toBe("Job 42; Genesis 12-15");
  });
});

describe("theme script", () => {
  it("uses the sage grounds for browser chrome", () => {
    expect(THEME_COLORS).toEqual({ light: "#f4f6f1", dark: "#141a16" });
  });

  it("updates every theme-color meta before paint when an override is saved", () => {
    const content = ["", ""];
    const metas = content.map((_, index) => ({ setAttribute: (_name: string, value: string) => { content[index] = value; } }));
    for (const theme of ["light", "dark"] as const) {
      new Function("document", "localStorage", THEME_SCRIPT)(
        { documentElement: { dataset: {} }, querySelectorAll: () => metas },
        memoryStorage({ "bible-journey:settings": JSON.stringify({ theme }) }),
      );
      expect(content).toEqual([THEME_COLORS[theme], THEME_COLORS[theme]]);
    }
  });

  function run(stored: string | null) {
    const root = { dataset: {} as Record<string, string> };
    const storage = memoryStorage(stored === null ? {} : { "bible-journey:settings": stored });
    new Function("document", "localStorage", THEME_SCRIPT)({ documentElement: root }, storage);
    return root.dataset.theme;
  }

  it("sets the saved light or dark theme before paint and leaves system alone", () => {
    expect(run(JSON.stringify({ theme: "dark" }))).toBe("dark");
    expect(run(JSON.stringify({ theme: "light" }))).toBe("light");
    expect(run(JSON.stringify({ theme: "system" }))).toBeUndefined();
    expect(run("{broken")).toBeUndefined();
    expect(run(null)).toBeUndefined();
  });
});

function fakeProfile(row: ProfileFields | null) {
  const saves: Partial<ProfileFields>[] = [];
  const remote: ProfileRemote & { row: ProfileFields | null } = {
    row,
    async load() {
      return remote.row;
    },
    async save(fields) {
      saves.push(fields);
      remote.row = { ...(remote.row ?? { theme: "system", link_translation: "NIV", reminder_time: null, timezone: "UTC" }), ...fields };
    },
  };
  return { remote, saves };
}

describe("reconcileProfile", () => {
  const local = { theme: "dark" as const, linkTranslation: "ESV" as const, reminderTime: "06:30" };
  const account: ProfileFields = { theme: "light", link_translation: "KJV", reminder_time: "08:15:00", timezone: "Europe/London" };

  it("lets this device's settings win on a first sign-in", async () => {
    const { remote, saves } = fakeProfile(account);
    const result = await reconcileProfile({ local, link: { user: null, dirty: false }, userId: "u1", timezone: "America/Chicago", remote });
    expect(result.settings).toEqual(local);
    expect(result.link).toEqual({ user: "u1", dirty: false });
    expect(saves).toEqual([{ theme: "dark", link_translation: "ESV", timezone: "America/Chicago" }]);
  });

  it("follows the account once this device is linked", async () => {
    const { remote, saves } = fakeProfile(account);
    const result = await reconcileProfile({ local, link: { user: "u1", dirty: false }, userId: "u1", timezone: "Europe/London", remote });
    expect(result.settings).toEqual({ theme: "light", linkTranslation: "KJV", reminderTime: "08:15" });
    expect(saves).toEqual([]);
  });

  it("records a new time zone for the reader", async () => {
    const { remote, saves } = fakeProfile(account);
    await reconcileProfile({ local, link: { user: "u1", dirty: false }, userId: "u1", timezone: "Asia/Tokyo", remote });
    expect(saves).toEqual([{ timezone: "Asia/Tokyo" }]);
  });

  it("pushes changes made while offline instead of overwriting them", async () => {
    const { remote, saves } = fakeProfile(account);
    const result = await reconcileProfile({ local, link: { user: "u1", dirty: true }, userId: "u1", timezone: "Europe/London", remote });
    expect(result.settings).toEqual(local);
    expect(saves).toEqual([{ theme: "dark", link_translation: "ESV", timezone: "Europe/London" }]);
    expect(result.link).toEqual({ user: "u1", dirty: false });
  });

  it("treats a different account as a first sign-in", async () => {
    const { remote } = fakeProfile(account);
    const result = await reconcileProfile({ local, link: { user: "someone-else", dirty: false }, userId: "u1", timezone: "UTC", remote });
    expect(result.settings).toEqual(local);
  });

  it("keeps the local reminder time when the account has none", async () => {
    const { remote } = fakeProfile({ ...account, reminder_time: null, link_translation: "bogus" });
    const result = await reconcileProfile({ local, link: { user: "u1", dirty: false }, userId: "u1", timezone: "Europe/London", remote });
    expect(result.settings).toEqual({ theme: "light", linkTranslation: "ESV", reminderTime: "06:30" });
  });
});
