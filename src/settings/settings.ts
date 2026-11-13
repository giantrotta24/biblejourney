import { z } from "zod";

export const TRANSLATIONS = [
  { code: "NIV", name: "New International Version" },
  { code: "ESV", name: "English Standard Version" },
  { code: "NLT", name: "New Living Translation" },
  { code: "KJV", name: "King James Version" },
  { code: "NKJV", name: "New King James Version" },
  { code: "CSB", name: "Christian Standard Bible" },
  { code: "NRSVUE", name: "New Revised Standard Version, Updated Edition" },
] as const;

export const THEMES = ["system", "light", "dark"] as const;

export type Theme = (typeof THEMES)[number];
export type TranslationCode = (typeof TRANSLATIONS)[number]["code"];
export type Settings = { theme: Theme; linkTranslation: TranslationCode; reminderTime: string };

export const SETTINGS_KEY = "bible-journey:settings";
export const DEFAULT_SETTINGS: Settings = { theme: "system", linkTranslation: "NIV", reminderTime: "07:00" };

const codes = TRANSLATIONS.map((t) => t.code) as [TranslationCode, ...TranslationCode[]];
const fields = {
  theme: z.enum(THEMES),
  linkTranslation: z.enum(codes),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
};

export const THEME_COLORS = { light: "#f3f5f9", dark: "#0e1424" } as const;

export const THEME_SCRIPT = `try{var t=JSON.parse(localStorage.getItem(${JSON.stringify(SETTINGS_KEY)})||"{}").theme;if(t==="light"||t==="dark"){document.documentElement.dataset.theme=t;var c=${JSON.stringify(THEME_COLORS)}[t];document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",c)})}}catch(e){}`;

function pick<K extends keyof Settings>(input: Record<string, unknown>, key: K): Settings[K] {
  const result = fields[key].safeParse(input[key]);
  return (result.success ? result.data : DEFAULT_SETTINGS[key]) as Settings[K];
}

function fromObject(input: unknown): Settings {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return { theme: pick(record, "theme"), linkTranslation: pick(record, "linkTranslation"), reminderTime: pick(record, "reminderTime") };
}

export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return fromObject(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type SettingsStore = {
  getSnapshot(): Settings;
  subscribe(listener: () => void): () => void;
  update(patch: Partial<Settings>): boolean;
  replace(next: Settings): void;
};

const same = (a: Settings, b: Settings) =>
  a.theme === b.theme && a.linkTranslation === b.linkTranslation && a.reminderTime === b.reminderTime;

export function createSettingsStore(storage: KeyValueStorage | null): SettingsStore {
  const listeners = new Set<() => void>();
  let current: Settings;
  try {
    current = parseSettings(storage?.getItem(SETTINGS_KEY) ?? null);
  } catch {
    current = DEFAULT_SETTINGS;
  }

  function replace(next: Settings) {
    if (same(current, next)) return;
    current = next;
    try {
      storage?.setItem(SETTINGS_KEY, JSON.stringify(next));
    } catch {}
    for (const listener of listeners) listener();
  }

  return {
    getSnapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(patch) {
      for (const key of Object.keys(patch) as (keyof Settings)[]) {
        if (!fields[key].safeParse(patch[key]).success) return false;
      }
      const next = { ...current, ...patch };
      if (same(current, next)) return false;
      replace(next);
      return true;
    },
    replace: (next) => replace(fromObject(next)),
  };
}

export type ProfileFields = { theme: string; link_translation: string; reminder_time: string | null; timezone: string };
export type ProfileRemote = {
  load(): Promise<ProfileFields | null>;
  save(fields: Partial<ProfileFields>): Promise<void>;
};
export type SettingsLink = { user: string | null; dirty: boolean };

export function profileFields(settings: Settings, timezone: string): Partial<ProfileFields> {
  return { theme: settings.theme, link_translation: settings.linkTranslation, timezone };
}

export async function reconcileProfile({
  local,
  link,
  userId,
  timezone,
  remote,
}: {
  local: Settings;
  link: SettingsLink;
  userId: string;
  timezone: string;
  remote: ProfileRemote;
}): Promise<{ settings: Settings; link: SettingsLink }> {
  if (link.user !== userId || link.dirty) {
    await remote.save(profileFields(local, timezone));
    return { settings: local, link: { user: userId, dirty: false } };
  }

  const row = await remote.load();
  if (!row) {
    await remote.save(profileFields(local, timezone));
    return { settings: local, link };
  }
  if (row.timezone !== timezone) await remote.save({ timezone });
  const settings = fromObject({
    theme: row.theme,
    linkTranslation: fields.linkTranslation.safeParse(row.link_translation).success ? row.link_translation : local.linkTranslation,
    reminderTime: row.reminder_time?.slice(0, 5) ?? local.reminderTime,
  });
  return { settings, link };
}
