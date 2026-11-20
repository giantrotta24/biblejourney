import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/account/session';
import { supabase } from '@/account/supabase';
import { applyColorScheme } from '@/theme/scheme';

import { createProfileSync, type ProfileSync } from './profile-sync';
import {
  createSettingsStore,
  DEFAULT_SETTINGS,
  parseSettings,
  SETTINGS_KEY,
  SETTINGS_LINK_KEY,
  type KeyValueStorage,
  type ProfileFields,
  type ProfileRemote,
  type Settings,
  type SettingsStore,
} from './settings';

const memory = new Map<string, string>();

const storage: KeyValueStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
    void AsyncStorage.setItem(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
    void AsyncStorage.removeItem(key);
  },
};

const store: SettingsStore = createSettingsStore(storage);
const profile: ProfileSync = createProfileSync({ store, storage, applyTheme: applyColorScheme });

let boot: Promise<void> | null = null;

export async function loadSettings(): Promise<void> {
  let raw: string | null = null;
  let link: string | null = null;
  try {
    [raw, link] = await Promise.all([AsyncStorage.getItem(SETTINGS_KEY), AsyncStorage.getItem(SETTINGS_LINK_KEY)]);
  } catch {
    raw = null;
    link = null;
  }
  if (link) memory.set(SETTINGS_LINK_KEY, link);
  else memory.delete(SETTINGS_LINK_KEY);
  if (raw) memory.set(SETTINGS_KEY, raw);
  else memory.delete(SETTINGS_KEY);
  store.replace(parseSettings(raw));
  applyColorScheme(store.getSnapshot().theme);
}

export function whenSettingsReady(): Promise<void> {
  boot ??= loadSettings().then(
    () => undefined,
    () => undefined,
  );
  return boot;
}

export function resetSettingsForTests() {
  memory.clear();
  store.replace(DEFAULT_SETTINGS);
  profile.signedOut();
  applyColorScheme('system');
  boot = null;
}

export function changeSettings(patch: Partial<Settings>): boolean {
  const changed = store.update(patch);
  if (!changed) return false;
  if (patch.theme) applyColorScheme(store.getSnapshot().theme);
  if (patch.theme !== undefined || patch.linkTranslation !== undefined) void profile.changed();
  return true;
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
    () => DEFAULT_SETTINGS,
  );
}

function profileRemote(client: SupabaseClient, userId: string): ProfileRemote | null {
  if (typeof (client as { from?: unknown }).from !== 'function') return null;
  return {
    async load() {
      const { data, error } = await client
        .from('profiles')
        .select('theme, link_translation')
        .eq('user_id', userId)
        .maybeSingle<ProfileFields>();
      if (error) throw error;
      return data;
    },
    async save(fields) {
      const { error } = await client.from('profiles').upsert({ user_id: userId, ...fields }, { onConflict: 'user_id' });
      if (error) throw error;
    },
  };
}

export function SettingsSync() {
  const session = useSession();
  const previous = useRef(session.status);

  useEffect(() => {
    const was = previous.current;
    previous.current = session.status;
    let live = true;
    void whenSettingsReady().then(() => {
      if (!live || !supabase) return;
      if (session.status === 'signed-in' && session.user) {
        const remote = profileRemote(supabase, session.user.id);
        if (remote) void profile.signedIn(session.user.id, remote);
        return;
      }
      if (was === 'signed-in') profile.signedOut();
    });
    return () => {
      live = false;
    };
  }, [session.status, session.user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void profile.retry();
    });
    return () => subscription.remove();
  }, []);

  return null;
}
