import type { NoteRow } from '@/notes/store';
import type { DayRow } from '@/progress/store';
import type { VerseRow } from '@/verses/store';

import type { SyncStore } from './engine';
import { mergeDays, mergeNotes, mergeVerses, sameDays, sameNotes, sameVerses } from './merge';

export type BookPort<T> = {
  read: () => readonly T[];
  ready: () => boolean;
  unavailable: () => boolean;
  unreadable: () => boolean;
  replace: (rows: readonly T[]) => void;
};

export type RegisterBook = {
  (kind: 'days', book: BookPort<DayRow>): () => void;
  (kind: 'verses', book: BookPort<VerseRow>): () => void;
  (kind: 'notes', book: BookPort<NoteRow>): () => void;
};

export function createPortStore(options?: { onReady?: () => void }) {
  let days: BookPort<DayRow> | null = null;
  let verses: BookPort<VerseRow> | null = null;
  let notes: BookPort<NoteRow> | null = null;
  let snapshot: unknown = {};
  let wasSettled = false;

  function publish() {
    snapshot = {};
  }

  function settled(book: { ready: () => boolean; unavailable: () => boolean } | null) {
    return book != null && (book.ready() || book.unavailable());
  }

  function settledAll() {
    return settled(days) && settled(verses) && settled(notes);
  }

  function booksChanged() {
    const ready = settledAll();
    if (ready && !wasSettled) options?.onReady?.();
    wasSettled = ready;
  }

  const store: SyncStore = {
    async load() {
      while (!settledAll()) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      const books = [days, verses, notes];
      if (books.some((book) => !book || book.unavailable() || book.unreadable() || !book.ready())) return false;
      return true;
    },
    rows() {
      return {
        days: [...(days?.read() ?? [])],
        verses: [...(verses?.read() ?? [])],
        notes: [...(notes?.read() ?? [])],
      };
    },
    getSnapshot: () => snapshot,
    async mergeDays(input) {
      if (!days) return;
      const next = mergeDays(days.read(), input);
      if (sameDays(next, days.read())) return;
      days.replace(next);
      publish();
    },
    async mergeVerses(input) {
      if (!verses) return;
      const next = mergeVerses(verses.read(), input);
      if (sameVerses(next, verses.read())) return;
      verses.replace(next);
      publish();
    },
    async mergeNotes(input) {
      if (!notes) return;
      const next = mergeNotes(notes.read(), input);
      if (sameNotes(next, notes.read())) return;
      notes.replace(next);
      publish();
    },
    async removeDay(dayIndex) {
      if (!days) return;
      const current = days.read();
      if (!current.some((row) => row.day_index === dayIndex)) return;
      days.replace(current.filter((row) => row.day_index !== dayIndex));
      publish();
    },
    async removeVerse(week) {
      if (!verses) return;
      const current = verses.read();
      if (!current.some((row) => row.week === week)) return;
      verses.replace(current.filter((row) => row.week !== week));
      publish();
    },
    async removeNote(dayIndex) {
      if (!notes) return;
      const current = notes.read();
      if (!current.some((row) => row.day_index === dayIndex)) return;
      notes.replace(current.filter((row) => row.day_index !== dayIndex));
      publish();
    },
  };

  const register: RegisterBook = (kind, book) => {
    if (kind === 'days') {
      const next = book as BookPort<DayRow>;
      days = next;
      booksChanged();
      return () => {
        if (days === next) days = null;
        booksChanged();
      };
    }
    if (kind === 'verses') {
      const next = book as BookPort<VerseRow>;
      verses = next;
      booksChanged();
      return () => {
        if (verses === next) verses = null;
        booksChanged();
      };
    }
    const next = book as BookPort<NoteRow>;
    notes = next;
    booksChanged();
    return () => {
      if (notes === next) notes = null;
      booksChanged();
    };
  };

  return { store, register };
}
