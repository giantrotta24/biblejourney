export const TRANSLATIONS = [
  { code: 'NIV', name: 'New International Version' },
  { code: 'ESV', name: 'English Standard Version' },
  { code: 'NLT', name: 'New Living Translation' },
  { code: 'KJV', name: 'King James Version' },
  { code: 'NKJV', name: 'New King James Version' },
  { code: 'CSB', name: 'Christian Standard Bible' },
  { code: 'NRSVUE', name: 'New Revised Standard Version, Updated Edition' },
] as const;

export const THEMES = ['system', 'light', 'dark'] as const;

export type Theme = (typeof THEMES)[number];
export type TranslationCode = (typeof TRANSLATIONS)[number]['code'];
export type Settings = { theme: Theme; linkTranslation: TranslationCode };

export const SETTINGS_KEY = 'biblejourney.settings.v1';
export const SETTINGS_LINK_KEY = 'biblejourney.settings-link.v1';
export const DEFAULT_SETTINGS: Settings = { theme: 'system', linkTranslation: 'NIV' };

export type ProfileFields = { theme: string; link_translation: string };
export type ProfileRemote = {
  load(): Promise<ProfileFields | null>;
  save(fields: ProfileFields): Promise<void>;
};
export type SettingsLink = { user: string | null; dirty: boolean };

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

const CODES: readonly string[] = TRANSLATIONS.map((item) => item.code);

export function isTheme(value: unknown): value is Theme {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function isTranslation(value: unknown): value is TranslationCode {
  return typeof value === 'string' && CODES.includes(value);
}

export function parseSettings(raw: string | null): Settings {
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const record = JSON.parse(raw) as { theme?: unknown; linkTranslation?: unknown };
    return {
      theme: isTheme(record.theme) ? record.theme : DEFAULT_SETTINGS.theme,
      linkTranslation: isTranslation(record.linkTranslation) ? record.linkTranslation : DEFAULT_SETTINGS.linkTranslation,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function same(a: Settings, b: Settings) {
  return a.theme === b.theme && a.linkTranslation === b.linkTranslation;
}

export function createSettingsStore(storage: KeyValueStorage | null): SettingsStore {
  const listeners = new Set<() => void>();
  let current = DEFAULT_SETTINGS;
  try {
    current = parseSettings(storage?.getItem(SETTINGS_KEY) ?? null);
  } catch {
    current = DEFAULT_SETTINGS;
  }

  function replace(next: Settings) {
    const parsed = parseSettings(JSON.stringify(next));
    if (same(current, parsed)) return;
    current = parsed;
    try {
      storage?.setItem(SETTINGS_KEY, JSON.stringify(parsed));
    } catch {
      // The in-memory value still applies on this phone.
    }
    for (const listener of listeners) listener();
  }

  return {
    getSnapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(patch) {
      if (patch.theme !== undefined && !isTheme(patch.theme)) return false;
      if (patch.linkTranslation !== undefined && !isTranslation(patch.linkTranslation)) return false;
      const next = { ...current, ...patch };
      if (same(current, next)) return false;
      replace(next);
      return true;
    },
    replace,
  };
}
