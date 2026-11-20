import type { NoteRow } from '@/notes/store';
import type { DayRow } from '@/progress/store';
import type { VerseRow } from '@/verses/store';

import { RemoteRefusedError, type RemoteAccount, type RemoteBooks, type RemoteChange, type RemotePull } from './remote';

type Account = {
  days: Map<number, DayRow>;
  verses: Map<number, VerseRow>;
  notes: Map<number, NoteRow>;
  resetAt: string | null;
};

export type FakeDevice = RemoteAccount & {
  online: boolean;
  sessionDropped: boolean;
  holdNextPull(): () => void;
  failNext(method: keyof Omit<RemoteAccount, 'subscribe'>, times?: number): void;
  refuseNext(method: keyof Omit<RemoteAccount, 'subscribe'>, times?: number): void;
  calls: string[];
};

const earliest = <R>(existing: R | undefined, row: R, time: (row: R) => string) =>
  existing && time(existing) <= time(row) ? existing : row;

const latest = (existing: NoteRow | undefined, row: NoteRow) =>
  existing && existing.updated_at > row.updated_at ? existing : row;

export function createFakeServer() {
  const accounts = new Map<string, Account>();
  const listeners = new Map<string, Set<(change: RemoteChange) => void>>();
  let resets = 0;

  function account(userId: string): Account {
    let found = accounts.get(userId);
    if (!found) {
      found = { days: new Map(), verses: new Map(), notes: new Map(), resetAt: null };
      accounts.set(userId, found);
    }
    return found;
  }

  function broadcast(userId: string, change: RemoteChange) {
    for (const listener of listeners.get(userId) ?? []) queueMicrotask(() => listener(change));
  }

  function rows(userId: string): RemoteBooks {
    const owned = account(userId);
    return {
      days: [...owned.days.values()].sort((a, b) => a.day_index - b.day_index),
      verses: [...owned.verses.values()].sort((a, b) => a.week - b.week),
      notes: [...owned.notes.values()].sort((a, b) => a.day_index - b.day_index),
    };
  }

  function device(userId: string): FakeDevice {
    const failing = new Map<string, number>();
    const refusing = new Map<string, number>();
    const calls: string[] = [];
    let held: Promise<void> | null = null;

    function guard(method: string) {
      calls.push(method);
      if (!self.online) throw new TypeError('Failed to fetch');
      const refusals = refusing.get(method) ?? 0;
      if (refusals > 0) {
        refusing.set(method, refusals - 1);
        throw new RemoteRefusedError(`${method} refused`, 403);
      }
      const left = failing.get(method) ?? 0;
      if (left > 0) {
        failing.set(method, left - 1);
        throw new Error(`${method} failed`);
      }
    }

    function ifSignedIn(write: () => void) {
      if (!self.sessionDropped) write();
    }

    const self: FakeDevice = {
      online: true,
      sessionDropped: false,
      calls,
      holdNextPull() {
        let release = () => {};
        held = new Promise((resolve) => {
          release = resolve;
        });
        return () => release();
      },
      failNext(method, times = 1) {
        failing.set(method, times);
      },
      refuseNext(method, times = 1) {
        refusing.set(method, times);
      },
      async pull() {
        guard('pull');
        const snapshot: RemotePull = self.sessionDropped
          ? { days: [], verses: [], notes: [], userId: null, resetAt: null }
          : { ...rows(userId), userId, resetAt: account(userId).resetAt };
        const gate = held;
        held = null;
        if (gate) await gate;
        return snapshot;
      },
      async putDays(input) {
        guard('putDays');
        ifSignedIn(() => {
          const { days } = account(userId);
          for (const row of input) {
            const kept = earliest(days.get(row.day_index), row, (item) => item.completed_at);
            days.set(row.day_index, kept);
            broadcast(userId, { kind: 'put-day', row: { ...kept } });
          }
        });
      },
      async deleteDay(dayIndex) {
        guard('deleteDay');
        ifSignedIn(() => {
          if (account(userId).days.delete(dayIndex)) broadcast(userId, { kind: 'delete-day', day_index: dayIndex });
        });
      },
      async putVerses(input) {
        guard('putVerses');
        ifSignedIn(() => {
          const { verses } = account(userId);
          for (const row of input) {
            const kept = earliest(verses.get(row.week), row, (item) => item.learned_at);
            verses.set(row.week, kept);
            broadcast(userId, { kind: 'put-verse', row: { ...kept } });
          }
        });
      },
      async deleteVerse(week) {
        guard('deleteVerse');
        ifSignedIn(() => {
          if (account(userId).verses.delete(week)) broadcast(userId, { kind: 'delete-verse', week });
        });
      },
      async putNotes(input) {
        guard('putNotes');
        ifSignedIn(() => {
          const { notes } = account(userId);
          for (const row of input) {
            const kept = latest(notes.get(row.day_index), row);
            notes.set(row.day_index, kept);
            broadcast(userId, { kind: 'put-note', row: { ...kept } });
          }
        });
      },
      async deleteNote(dayIndex, deletedAt) {
        guard('deleteNote');
        ifSignedIn(() => {
          const notes = account(userId).notes;
          const existing = notes.get(dayIndex);
          if (!existing || existing.updated_at > deletedAt) return;
          notes.delete(dayIndex);
          broadcast(userId, { kind: 'delete-note', day_index: dayIndex, deleted_at: deletedAt });
        });
      },
      async markReset() {
        guard('markReset');
        if (self.sessionDropped) return null;
        const owned = account(userId);
        for (const dayIndex of [...owned.days.keys()]) {
          owned.days.delete(dayIndex);
          broadcast(userId, { kind: 'delete-day', day_index: dayIndex });
        }
        for (const week of [...owned.verses.keys()]) {
          owned.verses.delete(week);
          broadcast(userId, { kind: 'delete-verse', week });
        }
        owned.resetAt = `server-reset-${(resets += 1)}`;
        return owned.resetAt;
      },
      subscribe(onChange) {
        let set = listeners.get(userId);
        if (!set) listeners.set(userId, (set = new Set()));
        const listener = (change: RemoteChange) => {
          if (self.online) onChange(change);
        };
        set.add(listener);
        return () => set.delete(listener);
      },
    };
    return self;
  }

  return { device, rows, resetAt: (userId: string) => account(userId).resetAt };
}
