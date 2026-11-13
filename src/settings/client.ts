"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import {
  createSettingsStore,
  DEFAULT_SETTINGS,
  profileFields,
  reconcileProfile,
  type KeyValueStorage,
  type ProfileFields,
  type ProfileRemote,
  type Settings,
  type SettingsLink,
  type SettingsStore,
  type Theme,
} from "./settings";

const LINK_KEY = "bible-journey:settings-link";

let store: SettingsStore | null = null;
let active: { userId: string; remote: ProfileRemote } | null = null;

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function settingsStore(): SettingsStore {
  store ??= createSettingsStore(browserStorage());
  return store;
}

function readLink(): SettingsLink {
  try {
    const parsed = JSON.parse(browserStorage()?.getItem(LINK_KEY) ?? "null") as Partial<SettingsLink> | null;
    return { user: typeof parsed?.user === "string" ? parsed.user : null, dirty: parsed?.dirty === true };
  } catch {
    return { user: null, dirty: false };
  }
}

function writeLink(link: SettingsLink) {
  try {
    browserStorage()?.setItem(LINK_KEY, JSON.stringify(link));
  } catch {}
}

export function readerTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

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

async function pushToProfile() {
  const link = readLink();
  if (link.user) writeLink({ ...link, dirty: true });
  const session = active;
  if (!session || link.user !== session.userId) return;
  try {
    await session.remote.save(profileFields(settingsStore().getSnapshot(), readerTimeZone()));
    if (active === session) writeLink({ user: session.userId, dirty: false });
  } catch {}
}

export function changeSettings(patch: Partial<Settings>) {
  if (!settingsStore().update(patch)) return;
  if (patch.theme) applyTheme(patch.theme);
  if (patch.theme || patch.linkTranslation) void pushToProfile();
}

export async function settingsSignedIn(client: SupabaseClient, userId: string) {
  if (active?.userId === userId) return;
  const session = { userId, remote: supabaseProfile(client, userId) };
  active = session;
  try {
    const result = await reconcileProfile({
      local: settingsStore().getSnapshot(),
      link: readLink(),
      userId,
      timezone: readerTimeZone(),
      remote: session.remote,
    });
    if (active !== session) return;
    settingsStore().replace(result.settings);
    applyTheme(result.settings.theme);
    writeLink(result.link);
  } catch {
    if (active === session) active = null;
  }
}

export function settingsSignedOut() {
  active = null;
  writeLink({ user: null, dirty: false });
}

const subscribe = (listener: () => void) => settingsStore().subscribe(listener);

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, () => settingsStore().getSnapshot(), () => DEFAULT_SETTINGS);
}

export function useLinkTranslation() {
  return useSyncExternalStore(subscribe, () => settingsStore().getSnapshot().linkTranslation, () => DEFAULT_SETTINGS.linkTranslation);
}
