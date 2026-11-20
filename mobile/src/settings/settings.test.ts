import { describe, expect, it } from '@jest/globals';

import { createSettingsStore, DEFAULT_SETTINGS, parseSettings, TRANSLATIONS, type KeyValueStorage } from './settings';

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('settings', () => {
  it('starts on Match the phone and the NIV', () => {
    expect(DEFAULT_SETTINGS).toEqual({ theme: 'system', linkTranslation: 'NIV' });
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ theme: 'sepia', linkTranslation: 'NOPE' }))).toEqual(DEFAULT_SETTINGS);
  });

  it('stores a theme and a Bible Gateway translation', () => {
    const storage = memory();
    const store = createSettingsStore(storage);
    expect(store.update({ theme: 'dark' })).toBe(true);
    expect(store.update({ linkTranslation: 'ESV' })).toBe(true);
    expect(store.getSnapshot()).toEqual({ theme: 'dark', linkTranslation: 'ESV' });
    expect(store.update({ linkTranslation: 'ESV' })).toBe(false);
    expect(store.update({ theme: 'neon' as 'dark' })).toBe(false);

    const restored = createSettingsStore(storage);
    expect(restored.getSnapshot()).toEqual({ theme: 'dark', linkTranslation: 'ESV' });
    expect(TRANSLATIONS.map((item) => item.code)).toEqual(['NIV', 'ESV', 'NLT', 'KJV', 'NKJV', 'CSB', 'NRSVUE']);
  });
});
