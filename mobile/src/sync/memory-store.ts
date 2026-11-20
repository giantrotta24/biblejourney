import type { NoteRow } from '@/notes/store';
import type { DayRow } from '@/progress/store';
import { DAY_COUNT, WEEK_COUNT } from '../../../supabase/functions/_shared/content/plan';
import type { VerseRow } from '@/verses/store';

import type { Sync, SyncStore } from './engine';
import { mergeDays, mergeNotes, mergeVerses, sameDays, sameNotes, sameVerses } from './merge';
import type { RemoteBooks } from './remote';

export type { SyncStore } from './engine';

export type MemoryStore = SyncStore & {
  addDay(dayIndex: number): Promise<void>;
  addVerse(week: number): Promise<void>;
  addNote(dayIndex: number, body: string): Promise<void>;
  failNextLoad(): void;
};

function isDay(value: number) {
  return Number.isInteger(value) && value >= 0 && value < DAY_COUNT;
}

function isWeek(value: number) {
  return Number.isInteger(value) && value >= 1 && value <= WEEK_COUNT;
}

export function createMemoryStore(sync: Sync, now: () => Date = () => new Date()): MemoryStore {
  const days = new Map<number, DayRow>();
  const verses = new Map<number, VerseRow>();
  const notes = new Map<number, NoteRow>();
  let snapshot: unknown = {};
  let failLoads = 0;

  function publish() {
    snapshot = {};
  }

  function current(): RemoteBooks {
    return {
      days: [...days.values()].sort((a, b) => a.day_index - b.day_index),
      verses: [...verses.values()].sort((a, b) => a.week - b.week),
      notes: [...notes.values()].sort((a, b) => a.day_index - b.day_index),
    };
  }

  return {
    async load() {
      if (failLoads > 0) {
        failLoads -= 1;
        return false;
      }
      return true;
    },
    rows: current,
    getSnapshot: () => snapshot,
    failNextLoad() {
      failLoads += 1;
    },
    async mergeDays(input) {
      const next = mergeDays(current().days, input);
      if (sameDays(next, current().days)) return;
      days.clear();
      for (const row of next) days.set(row.day_index, row);
      publish();
    },
    async mergeVerses(input) {
      const next = mergeVerses(current().verses, input);
      if (sameVerses(next, current().verses)) return;
      verses.clear();
      for (const row of next) verses.set(row.week, row);
      publish();
    },
    async mergeNotes(input) {
      const next = mergeNotes(current().notes, input);
      if (sameNotes(next, current().notes)) return;
      notes.clear();
      for (const row of next) notes.set(row.day_index, row);
      publish();
    },
    async removeDay(dayIndex) {
      if (!days.delete(dayIndex)) return;
      publish();
    },
    async removeVerse(week) {
      if (!verses.delete(week)) return;
      publish();
    },
    async removeNote(dayIndex) {
      if (!notes.delete(dayIndex)) return;
      publish();
    },
    async addDay(dayIndex) {
      if (!isDay(dayIndex) || days.has(dayIndex)) return;
      const row = { day_index: dayIndex, completed_at: now().toISOString() };
      days.set(dayIndex, row);
      publish();
      await sync.recordLocal({ kind: 'put-day', row });
    },
    async addVerse(week) {
      if (!isWeek(week) || verses.has(week)) return;
      const row = { week, learned_at: now().toISOString() };
      verses.set(week, row);
      publish();
      await sync.recordLocal({ kind: 'put-verse', row });
    },
    async addNote(dayIndex, body) {
      if (!isDay(dayIndex) || body.length === 0) return;
      const row = { day_index: dayIndex, body, updated_at: now().toISOString() };
      notes.set(dayIndex, row);
      publish();
      await sync.recordLocal({ kind: 'put-note', row });
    },
  };
}
