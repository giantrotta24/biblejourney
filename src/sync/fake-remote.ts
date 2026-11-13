import type { DayRow, ProgressRows, VerseRow } from "@/progress/rows";
import { RemoteRefusedError, type RemoteChange, type RemoteProgress, type RemotePull } from "./remote";

type Account = { days: Map<number, DayRow>; verses: Map<number, VerseRow> };

export type FakeDevice = RemoteProgress & {
  online: boolean;
  sessionDropped: boolean;
  holdNextPull(): () => void;
  failNext(method: keyof Omit<RemoteProgress, "subscribe">, times?: number): void;
  refuseNext(method: keyof Omit<RemoteProgress, "subscribe">, times?: number): void;
  calls: string[];
};

const earliest = <R>(existing: R | undefined, row: R, time: (row: R) => string) =>
  existing && time(existing) <= time(row) ? existing : row;

export function createFakeServer() {
  const accounts = new Map<string, Account>();
  const listeners = new Map<string, Set<(change: RemoteChange) => void>>();

  function account(userId: string): Account {
    let found = accounts.get(userId);
    if (!found) {
      found = { days: new Map(), verses: new Map() };
      accounts.set(userId, found);
    }
    return found;
  }

  function broadcast(userId: string, change: RemoteChange) {
    for (const listener of listeners.get(userId) ?? []) queueMicrotask(() => listener(change));
  }

  function rows(userId: string): ProgressRows {
    const { days, verses } = account(userId);
    return {
      days: [...days.values()].sort((a, b) => a.day_index - b.day_index),
      verses: [...verses.values()].sort((a, b) => a.week - b.week),
    };
  }

  function device(userId: string): FakeDevice {
    const failing = new Map<string, number>();
    const refusing = new Map<string, number>();
    const calls: string[] = [];

    function guard(method: string) {
      calls.push(method);
      if (!self.online) throw new TypeError("Failed to fetch");
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

    let held: Promise<void> | null = null;

    function ifSignedIn(write: () => void) {
      if (!self.sessionDropped) write();
    }

    const self: FakeDevice = {
      online: true,
      sessionDropped: false,
      calls,
      holdNextPull() {
        let release = () => {};
        held = new Promise((resolve) => (release = resolve));
        return () => release();
      },
      failNext(method, times = 1) {
        failing.set(method, times);
      },
      refuseNext(method, times = 1) {
        refusing.set(method, times);
      },
      async pull() {
        guard("pull");
        const snapshot: RemotePull = self.sessionDropped ? { days: [], verses: [], userId: null } : { ...structuredClone(rows(userId)), userId };
        const gate = held;
        held = null;
        if (gate) await gate;
        return snapshot;
      },
      async putDays(input) {
        guard("putDays");
        ifSignedIn(() => {
          const { days } = account(userId);
          for (const row of input) {
            const kept = earliest(days.get(row.day_index), row, (r) => r.completed_at);
            days.set(row.day_index, kept);
            broadcast(userId, { kind: "put-day", row: { ...kept } });
          }
        });
      },
      async deleteDay(dayIndex) {
        guard("deleteDay");
        ifSignedIn(() => {
          if (account(userId).days.delete(dayIndex)) broadcast(userId, { kind: "delete-day", day_index: dayIndex });
        });
      },
      async putVerses(input) {
        guard("putVerses");
        ifSignedIn(() => {
          const { verses } = account(userId);
          for (const row of input) {
            const kept = earliest(verses.get(row.week), row, (r) => r.learned_at);
            verses.set(row.week, kept);
            broadcast(userId, { kind: "put-verse", row: { ...kept } });
          }
        });
      },
      async deleteVerse(week) {
        guard("deleteVerse");
        ifSignedIn(() => {
          if (account(userId).verses.delete(week)) broadcast(userId, { kind: "delete-verse", week });
        });
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

  return { device, rows };
}
