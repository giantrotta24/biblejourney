import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { createPhoneStorage } from '@/persist/phone-storage';

import { syncReminderSchedule } from './schedule';
import {
  createReminderStore,
  DEFAULT_REMINDER,
  parseReminder,
  REMINDER_KEY,
  type ReminderPreference,
} from './store';

// Phone-only. profiles.reminder_time is the web push schedule, and writing it would start those sends.
const storage = createPhoneStorage();
const store = createReminderStore(storage);
let boot: Promise<void> | null = null;
let generation = 0;
let loadFailed = false;

async function loadReminder(ticket: number) {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(REMINDER_KEY);
  } catch {
    if (ticket === generation) loadFailed = true;
    return;
  }
  if (ticket !== generation) return;
  loadFailed = false;
  if (store.touched()) return;
  storage.remember(REMINDER_KEY, raw);
  store.replace(parseReminder(raw));
}

export function whenReminderReady(): Promise<void> {
  const ticket = generation;
  boot ??= loadReminder(ticket).then(
    () => undefined,
    () => undefined,
  );
  return boot;
}

export function reminderLoadFailed(): boolean {
  return loadFailed;
}

export function retryReminderLoad(): Promise<void> {
  if (!loadFailed) return Promise.resolve();
  boot = null;
  return whenReminderReady();
}

export function resetReminderForTests() {
  generation += 1;
  storage.clear();
  store.resetQuiet();
  boot = null;
  loadFailed = false;
}

export function changeReminder(patch: Partial<ReminderPreference>): boolean {
  return store.update(patch);
}

export function reminderSnapshot(): ReminderPreference {
  return store.getSnapshot();
}

export async function turnReminderOff(): Promise<void> {
  const current = store.getSnapshot();
  store.update({ enabled: false, awaitingPermission: false });
  storage.remember(REMINDER_KEY, JSON.stringify(store.getSnapshot()));
  try {
    await storage.flush(REMINDER_KEY);
  } catch {
    // The off choice stays in memory for this session.
  }
  await syncReminderSchedule({ enabled: false, hour: current.hour, minute: current.minute, rows: [] });
}

export function useReminder(): ReminderPreference {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
    () => DEFAULT_REMINDER,
  );
}
