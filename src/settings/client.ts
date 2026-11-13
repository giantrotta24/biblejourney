"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { createProfileSync, type ProfileSync } from "./profile-sync";
import {
  createSettingsStore,
  DEFAULT_SETTINGS,
  type KeyValueStorage,
  type ProfileFields,
  type ProfileRemote,
  type Settings,
  type SettingsStore,
  type Theme,
  THEME_COLORS,
} from "./settings";

let booted: { store: SettingsStore; sync: ProfileSync } | null = null;

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  applyThemeColor(theme);
}

function applyThemeColor(theme: Theme) {
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = theme === "system" ? (meta.media.includes("dark") ? "dark" : "light") : theme;
    meta.content = THEME_COLORS[scheme];
  }
}

function boot() {
  if (!booted) {
    const storage = browserStorage();
    const store = createSettingsStore(storage);
    const sync = createProfileSync({ store, storage, timezone: readerTimeZone, applyTheme });
    booted = { store, sync };
    if (typeof window !== "undefined") {
      const retry = () => void sync.retry();
      window.addEventListener("online", retry);
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && retry());
    }
  }
  return booted;
}

const settingsStore = () => boot().store;

function supabaseProfile(client: SupabaseClient, userId: string): ProfileRemote {
  return {
    async load() {
      const { data, error } = await client
        .from("profiles")
        .select("theme, link_translation, reminder_time, timezone")
        .eq("user_id", userId)
        .maybeSingle<ProfileFields>();
      if (error) throw error;
      return data;
    },
    async save(fields) {
      const { error } = await client.from("profiles").upsert({ user_id: userId, ...fields }, { onConflict: "user_id" });
      if (error) throw error;
    },
  };
}

export function changeSettings(patch: Partial<Settings>) {
  if (!settingsStore().update(patch)) return;
  if (patch.theme) applyTheme(patch.theme);
  if (patch.theme || patch.linkTranslation) void boot().sync.changed();
}

export function settingsSignedIn(client: SupabaseClient, userId: string) {
  return boot().sync.signedIn(userId, supabaseProfile(client, userId));
}

export function settingsSignedOut() {
  boot().sync.signedOut();
}

const subscribe = (listener: () => void) => settingsStore().subscribe(listener);

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => settingsStore().getSnapshot(), () => DEFAULT_SETTINGS);
}

export function useLinkTranslation() {
  return useSyncExternalStore(subscribe, () => settingsStore().getSnapshot().linkTranslation, () => DEFAULT_SETTINGS.linkTranslation);
}

export function syncThemeColor() {
  applyThemeColor(settingsStore().getSnapshot().theme);
}
