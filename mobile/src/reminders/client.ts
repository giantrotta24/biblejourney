import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import { syncReminderSchedule } from './schedule';
import {
  createReminderStore,
  DEFAULT_REMINDER,
  parseReminder,
  REMINDER_KEY,
  type ReminderPreference,
} from './store';

// Phone-only. profiles.reminder_time is the web push schedule, and writing it would start those sends.
const memory = new Map<string, string>();

const storage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
    void AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
    void AsyncStorage.removeItem(key);
  },
};

const store = createReminderStore(storage);
let boot: Promise<void> | null = null;
let generation = 0;

async function loadReminder(ticket: number) {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(REMINDER_KEY);
  } catch {
    raw = null;
  }
  if (ticket !== generation || store.touched()) return;
  if (raw) memory.set(REMINDER_KEY, raw);
  else memory.delete(REMINDER_KEY);
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

export function resetReminderForTests() {
  generation += 1;
  memory.clear();
  store.resetQuiet();
  boot = null;
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
  await syncReminderSchedule({ enabled: false, hour: current.hour, minute: current.minute, rows: [] });
}

export function useReminder(): ReminderPreference {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
    () => DEFAULT_REMINDER,
  );
}
