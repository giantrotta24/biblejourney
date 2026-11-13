import type { DayRow, ProgressPersistence, ProgressRows, VerseRow } from "@/progress/rows";
import type { ProgressStore } from "@/progress/store";
import type { PendingQueue, QueuedOp } from "./queue";
import { changeKey, sendChange, type RemoteChange, type RemoteProgress } from "./remote";

export type SyncStatus = "off" | "syncing" | "synced" | "offline";

export type ProgressSync = {
  persistence: ProgressPersistence;
  attach(store: ProgressStore): void;
  start(userId: string, remote: RemoteProgress): Promise<void>;
  stop(): Promise<void>;
  flush(): Promise<void>;
  resync(): Promise<void>;
  idle(): Promise<void>;
  userId(): string | null;
  getStatus(): SyncStatus;
  subscribeStatus(listener: () => void): () => void;
};

type Session = { userId: string; remote: RemoteProgress; reconciled: boolean; unsubscribe: () => void };

const dayEcho = (row: DayRow) => `day:${row.day_index}:${row.completed_at}`;
const verseEcho = (row: VerseRow) => `verse:${row.week}:${row.learned_at}`;
const isDelete = (kind: RemoteChange["kind"]) => kind === "delete-day" || kind === "delete-verse";

function lastPending(ops: readonly QueuedOp[]): Map<string, RemoteChange["kind"]> {
  const last = new Map<string, RemoteChange["kind"]>();
  for (const op of ops) last.set(changeKey(op), op.kind);
  return last;
}

export function createProgressSync(local: ProgressPersistence, queue: PendingQueue): ProgressSync {
  let session: Session | null = null;
  let store: ProgressStore | null = null;
  let status: SyncStatus = "off";
  let linked: string | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  const linkedLoaded = queue.linkedUser().then(
    (value) => {
      linked ??= value;
    },
    () => {},
  );
  const statusListeners = new Set<() => void>();
  const echoes = new Set<string>();
  const inflight = new Set<Promise<unknown>>();

  function setStatus(next: SyncStatus) {
    if (status === next) return;
    status = next;
    for (const listener of statusListeners) listener();
  }

  function track<T>(promise: Promise<T>): Promise<T> {
    const settled = promise.then(
      () => {},
      () => {},
    );
    inflight.add(settled);
    void settled.then(() => inflight.delete(settled));
    return promise;
  }

  function attachedStore(): ProgressStore {
    if (!store) throw new Error("Progress sync has no store attached");
    return store;
  }

  async function record(change: RemoteChange, echo: string) {
    if (echoes.delete(echo)) return;
    await linkedLoaded;
    const userId = session?.userId ?? linked;
    if (!userId) return;
    await queue.push({ ...change, user_id: userId });
    if (session) void track(flush());
  }

  async function applyRows(rows: ProgressRows) {
    const keys = [...rows.days.map(dayEcho), ...rows.verses.map(verseEcho)];
    keys.forEach((key) => echoes.add(key));
    try {
      await attachedStore().merge(rows);
    } finally {
      keys.forEach((key) => echoes.delete(key));
    }
  }

  async function applyDelete(kind: "day" | "verse", key: number) {
    const target = attachedStore();
    const present = kind === "day" ? target.getSnapshot().days.has(key) : target.getSnapshot().verses.has(key);
    if (!present) return;
    const echo = `${kind}:${key}:delete`;
    echoes.add(echo);
    try {
      await (kind === "day" ? target.removeDay(key) : target.removeVerse(key));
    } finally {
      echoes.delete(echo);
    }
  }

  async function drain(s: Session): Promise<boolean> {
    for (const op of await queue.list(s.userId)) {
      if (session !== s) return false;
      try {
        await sendChange(s.remote, op);
      } catch {
        return false;
      }
      await queue.remove(op.id);
    }
    return true;
  }

  async function reconcile(s: Session): Promise<boolean> {
    const target = attachedStore();
    await Promise.all([target.load(), linkedLoaded]);
    await drain(s);
    const remote = await s.remote.pull();
    if (session !== s) return false;

    const pending = lastPending(await queue.list(s.userId));
    const blocked = (key: string) => {
      const kind = pending.get(key);
      return kind !== undefined && isDelete(kind);
    };
    const incoming: ProgressRows = {
      days: remote.days.filter((row) => !blocked(`day:${row.day_index}`)),
      verses: remote.verses.filter((row) => !blocked(`verse:${row.week}`)),
    };
    const remoteDays = new Map(remote.days.map((row) => [row.day_index, row]));
    const remoteVerses = new Map(remote.verses.map((row) => [row.week, row]));

    if (linked === s.userId) {
      const local = target.rows();
      for (const row of local.days) {
        if (!remoteDays.has(row.day_index) && !pending.has(`day:${row.day_index}`)) await applyDelete("day", row.day_index);
      }
      for (const row of local.verses) {
        if (!remoteVerses.has(row.week) && !pending.has(`verse:${row.week}`)) await applyDelete("verse", row.week);
      }
      await applyRows(incoming);
    } else {
      await applyRows(incoming);
      const local = target.rows();
      for (const row of local.days) {
        const theirs = remoteDays.get(row.day_index);
        if (!theirs || theirs.completed_at > row.completed_at) await queue.push({ kind: "put-day", row, user_id: s.userId });
      }
      for (const row of local.verses) {
        const theirs = remoteVerses.get(row.week);
        if (!theirs || theirs.learned_at > row.learned_at) await queue.push({ kind: "put-verse", row, user_id: s.userId });
      }
      linked = s.userId;
      await queue.setLinkedUser(s.userId);
    }

    s.reconciled = true;
    return drain(s);
  }

  async function applyChange(s: Session, change: RemoteChange) {
    await Promise.all([attachedStore().load(), linkedLoaded]);
    if (session !== s) return;
    const pendingKind = lastPending(await queue.list(s.userId)).get(changeKey(change));
    if (pendingKind !== undefined && isDelete(pendingKind) !== isDelete(change.kind)) return;
    switch (change.kind) {
      case "put-day":
        return applyRows({ days: [change.row], verses: [] });
      case "put-verse":
        return applyRows({ days: [], verses: [change.row] });
      case "delete-day":
        return applyDelete("day", change.day_index);
      case "delete-verse":
        return applyDelete("verse", change.week);
    }
  }

  function flush(): Promise<void> {
    if (!session) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          const s: Session | null = session;
          if (!s) break;
          setStatus("syncing");
          let ok: boolean;
          try {
            ok = s.reconciled ? await drain(s) : await reconcile(s);
          } catch {
            ok = false;
          }
          if (session !== s) continue;
          setStatus(ok ? "synced" : "offline");
          if (!ok) break;
        } while (again);
      } finally {
        running = null;
      }
    })();
    return track(running);
  }

  const persistence: ProgressPersistence = {
    load: () => local.load(),
    async putDays(rows) {
      await local.putDays(rows);
      for (const row of rows) await record({ kind: "put-day", row }, dayEcho(row));
    },
    async deleteDay(dayIndex) {
      await local.deleteDay(dayIndex);
      await record({ kind: "delete-day", day_index: dayIndex }, `day:${dayIndex}:delete`);
    },
    async putVerses(rows) {
      await local.putVerses(rows);
      for (const row of rows) await record({ kind: "put-verse", row }, verseEcho(row));
    },
    async deleteVerse(week) {
      await local.deleteVerse(week);
      await record({ kind: "delete-verse", week }, `verse:${week}:delete`);
    },
  };

  return {
    persistence,

    attach(target) {
      store = target;
    },

    start(userId, remote) {
      if (session?.userId === userId && session.remote === remote) return flush();
      session?.unsubscribe();
      const s: Session = { userId, remote, reconciled: false, unsubscribe: () => {} };
      session = s;
      s.unsubscribe = remote.subscribe((change) => {
        if (session === s) void track(applyChange(s, change).catch(() => {}));
      });
      return flush();
    },

    async stop() {
      const s = session;
      session = null;
      s?.unsubscribe();
      setStatus("off");
      await linkedLoaded;
      linked = null;
      await queue.setLinkedUser(null).catch(() => {});
    },

    flush,

    resync() {
      if (session) session.reconciled = false;
      return flush();
    },

    async idle() {
      while (inflight.size > 0) await Promise.all([...inflight]);
    },

    userId: () => session?.userId ?? null,
    getStatus: () => status,
    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
  };
}
