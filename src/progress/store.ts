import { DAY_COUNT, WEEK_COUNT } from "@/content/plan";
import type { DayRow, ProgressPersistence, ProgressRows, ProgressSnapshot, VerseRow } from "./rows";

export type ProgressStore = {
  getSnapshot(): ProgressSnapshot;
  subscribe(listener: () => void): () => void;
  load(): Promise<void>;
  addDay(dayIndex: number): Promise<void>;
  removeDay(dayIndex: number): Promise<void>;
  addVerse(week: number): Promise<void>;
  removeVerse(week: number): Promise<void>;
  merge(rows: ProgressRows): Promise<void>;
  rows(): ProgressRows;
};

export const LOADING_SNAPSHOT: ProgressSnapshot = { ready: false, days: new Set(), verses: new Set() };

function checkDay(dayIndex: number) {
  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex >= DAY_COUNT) throw new RangeError(`No reading day ${dayIndex}`);
}

function checkWeek(week: number) {
  if (!Number.isInteger(week) || week < 1 || week > WEEK_COUNT) throw new RangeError(`No week ${week}`);
}

function unionInto<K, R>(target: Map<K, R>, rows: readonly R[], key: (row: R) => K, time: (row: R) => string): R[] {
  const changed: R[] = [];
  for (const row of rows) {
    const existing = target.get(key(row));
    if (existing && time(existing) <= time(row)) continue;
    target.set(key(row), row);
    changed.push(row);
  }
  return changed;
}

const byDay = (a: DayRow, b: DayRow) => a.day_index - b.day_index;
const byWeek = (a: VerseRow, b: VerseRow) => a.week - b.week;

export function createProgressStore(persistence: ProgressPersistence, now: () => Date = () => new Date()): ProgressStore {
  const days = new Map<number, DayRow>();
  const verses = new Map<number, VerseRow>();
  const listeners = new Set<() => void>();
  let snapshot = LOADING_SNAPSHOT;
  let ready = false;
  let loading: Promise<void> | null = null;
  let writes: Promise<void> = Promise.resolve();

  function publish() {
    snapshot = { ready, days: new Set(days.keys()), verses: new Set(verses.keys()) };
    for (const listener of listeners) listener();
  }

  function persist(write: () => Promise<void>): Promise<void> {
    writes = writes.then(write).catch((error: unknown) => {
      console.warn("Progress was not saved on this device", error);
    });
    return writes;
  }

  return {
    getSnapshot: () => snapshot,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    load() {
      loading ??= persistence.load().then((rows) => {
        unionInto(days, rows.days, (row) => row.day_index, (row) => row.completed_at);
        unionInto(verses, rows.verses, (row) => row.week, (row) => row.learned_at);
        ready = true;
        publish();
      });
      return loading;
    },

    async addDay(dayIndex) {
      checkDay(dayIndex);
      if (days.has(dayIndex)) return;
      const row = { day_index: dayIndex, completed_at: now().toISOString() };
      days.set(dayIndex, row);
      publish();
      await persist(() => persistence.putDays([row]));
    },

    async removeDay(dayIndex) {
      checkDay(dayIndex);
      if (!days.delete(dayIndex)) return;
      publish();
      await persist(() => persistence.deleteDay(dayIndex));
    },

    async addVerse(week) {
      checkWeek(week);
      if (verses.has(week)) return;
      const row = { week, learned_at: now().toISOString() };
      verses.set(week, row);
      publish();
      await persist(() => persistence.putVerses([row]));
    },

    async removeVerse(week) {
      checkWeek(week);
      if (!verses.delete(week)) return;
      publish();
      await persist(() => persistence.deleteVerse(week));
    },

    async merge(rows) {
      rows.days.forEach((row) => checkDay(row.day_index));
      rows.verses.forEach((row) => checkWeek(row.week));
      const changedDays = unionInto(days, rows.days, (row) => row.day_index, (row) => row.completed_at);
      const changedVerses = unionInto(verses, rows.verses, (row) => row.week, (row) => row.learned_at);
      if (changedDays.length === 0 && changedVerses.length === 0) return;
      publish();
      await persist(async () => {
        if (changedDays.length) await persistence.putDays(changedDays);
        if (changedVerses.length) await persistence.putVerses(changedVerses);
      });
    },

    rows: () => ({ days: [...days.values()].sort(byDay), verses: [...verses.values()].sort(byWeek) }),
  };
}
