export const REMINDER_KEY = 'biblejourney.reminder.v1';

export type ReminderPreference = {
  enabled: boolean;
  hour: number;
  minute: number;
  awaitingPermission: boolean;
};

export const DEFAULT_REMINDER: ReminderPreference = {
  enabled: false,
  hour: 7,
  minute: 0,
  awaitingPermission: false,
};

type KeyValueStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function hourOf(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23 ? value : fallback;
}

function minuteOf(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 59 ? value : fallback;
}

export function parseReminder(raw: string | null): ReminderPreference {
  if (!raw) return DEFAULT_REMINDER;
  try {
    const record = JSON.parse(raw) as Partial<Record<keyof ReminderPreference, unknown>>;
    return {
      enabled: record.enabled === true,
      hour: hourOf(record.hour, DEFAULT_REMINDER.hour),
      minute: minuteOf(record.minute, DEFAULT_REMINDER.minute),
      awaitingPermission: record.awaitingPermission === true,
    };
  } catch {
    return DEFAULT_REMINDER;
  }
}

function same(a: ReminderPreference, b: ReminderPreference) {
  return (
    a.enabled === b.enabled &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.awaitingPermission === b.awaitingPermission
  );
}

export type ReminderStore = {
  getSnapshot(): ReminderPreference;
  subscribe(listener: () => void): () => void;
  update(patch: Partial<ReminderPreference>): boolean;
  replace(next: ReminderPreference): void;
  touched(): boolean;
  resetQuiet(): void;
};

export function createReminderStore(storage: KeyValueStorage | null): ReminderStore {
  const listeners = new Set<() => void>();
  let current = DEFAULT_REMINDER;
  let touched = false;
  try {
    current = parseReminder(storage?.getItem(REMINDER_KEY) ?? null);
  } catch {
    current = DEFAULT_REMINDER;
  }

  function write(next: ReminderPreference) {
    current = next;
    try {
      storage?.setItem(REMINDER_KEY, JSON.stringify(next));
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
      const next = {
        enabled: patch.enabled ?? current.enabled,
        hour: patch.hour === undefined ? current.hour : hourOf(patch.hour, -1),
        minute: patch.minute === undefined ? current.minute : minuteOf(patch.minute, -1),
        awaitingPermission: patch.awaitingPermission ?? current.awaitingPermission,
      };
      if (next.hour < 0 || next.minute < 0) return false;
      if (same(current, next)) return false;
      touched = true;
      write(next);
      return true;
    },
    replace(next) {
      const parsed = parseReminder(JSON.stringify(next));
      if (same(current, parsed)) return;
      write(parsed);
    },
    touched: () => touched,
    resetQuiet() {
      const changed = !same(current, DEFAULT_REMINDER);
      current = DEFAULT_REMINDER;
      touched = false;
      if (changed) for (const listener of listeners) listener();
    },
  };
}
