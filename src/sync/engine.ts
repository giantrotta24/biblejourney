import type { DayRow, ProgressPersistence, ProgressRows, VerseRow } from "@/progress/rows";
import type { ProgressStore } from "@/progress/store";
import type { PendingQueue, QueuedOp } from "./queue";
import { changeKey, isRefusal, sendChange, type RemoteChange, type RemoteProgress } from "./remote";

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
  rejectedCount(): number;
  markReset(at: string): Promise<void>;
  subscribeStatus(listener: () => void): () => void;
  subscribeRemote(listener: () => void): () => void;
};

type Session = {
  userId: string;
  remote: RemoteProgress;
  reconciled: boolean;
  buffer: RemoteChange[] | null;
  unsubscribe: () => void;
};

const dayEcho = (row: DayRow) => `day:${row.day_index}:${row.completed_at}`;
const verseEcho = (row: VerseRow) => `verse:${row.week}:${row.learned_at}`;
async function both(write: Promise<void>, records: Promise<void>[]): Promise<void> {
  const results = await Promise.allSettled([write, ...records]);
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
}

const isDelete = (kind: RemoteChange["kind"]) => kind === "delete-day" || kind === "delete-verse";
type Recorded = DayRow | VerseRow | "delete";

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
  let rejected = 0;
  let resetSeen: string | null = null;
  const linkedLoaded = Promise.all([
    queue.resetSeen().then(
      (value) => {
        resetSeen ??= value;
      },
      () => {},
    ),
    queue.linkedUser().then(
      (value) => {
        linked ??= value;
      },
      () => {},
    ),
    queue.rejectedCount().then(
      (value) => {
        rejected += value;
      },
      () => {},
    ),
  ]);
  const statusListeners = new Set<() => void>();
  const remoteListeners = new Set<() => void>();
  const echoes = new Set<string>();
  const recorded = new Map<string, Recorded>();
  const unrecorded = new Set<string>();
  const inflight = new Set<Promise<unknown>>();

  function notifyStatus() {
    for (const listener of statusListeners) listener();
  }

  function setStatus(next: SyncStatus) {
    if (status === next) return;
    status = next;
    notifyStatus();
  }

  async function addRejected() {
    rejected += 1;
    notifyStatus();
    await queue.setRejectedCount(rejected).catch(() => {});
  }

  async function fromRemote(apply: () => Promise<void>) {
    const before = attachedStore().getSnapshot();
    await apply();
    if (attachedStore().getSnapshot() === before) return;
    for (const listener of remoteListeners) listener();
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

  async function record(change: RemoteChange, token: Recorded, echo: string) {
    const key = changeKey(change);
    if (recorded.get(key) === token || echoes.delete(echo)) {
      recorded.set(key, token);
      unrecorded.delete(key);
      return;
    }
    await linkedLoaded;
    const userId = session?.userId ?? linked;
    if (!userId) {
      unrecorded.delete(key);
      return;
    }
    try {
      await queue.push({ ...change, user_id: userId });
    } catch (error) {
      unrecorded.add(key);
      throw error;
    }
    recorded.set(key, token);
    unrecorded.delete(key);
    if (session) void track(flush());
  }

  async function rememberReset(at: string | null) {
    resetSeen = at;
    await queue.setResetSeen(at).catch(() => {});
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
      } catch (error) {
        if (!isRefusal(error)) return false;
        console.warn("The server refused a progress change", error);
        await addRejected();
      }
      await queue.remove(op.id);
    }
    return true;
  }

  async function reconcile(s: Session): Promise<boolean> {
    s.buffer ??= [];
    try {
      return await applySnapshot(s);
    } finally {
      const buffered = s.buffer ?? [];
      s.buffer = null;
      for (const change of buffered) await applyChange(s, change).catch(() => {});
    }
  }

  async function applySnapshot(s: Session): Promise<boolean> {
    const target = attachedStore();
    await Promise.all([target.load(), linkedLoaded]);
    await drain(s);
    const remote = await s.remote.pull();
    if (session !== s || remote.userId !== s.userId) return false;

    const pending = lastPending(await queue.list(s.userId));
    const held = (key: string) => pending.has(key) || unrecorded.has(key);
    const blocked = (key: string) => {
      const kind = pending.get(key);
      return unrecorded.has(key) || (kind !== undefined && isDelete(kind));
    };
    const current = target.rows();
    const removable =
      current.days.some((row) => !held(`day:${row.day_index}`)) || current.verses.some((row) => !held(`verse:${row.week}`));
    const resetElsewhere = remote.resetAt !== null && remote.resetAt !== resetSeen;
    if (linked === s.userId && remote.days.length === 0 && remote.verses.length === 0 && removable && !resetElsewhere) return false;
    const incoming: ProgressRows = {
      days: remote.days.filter((row) => !blocked(`day:${row.day_index}`)),
      verses: remote.verses.filter((row) => !blocked(`verse:${row.week}`)),
    };
    const remoteDays = new Map(remote.days.map((row) => [row.day_index, row]));
    const remoteVerses = new Map(remote.verses.map((row) => [row.week, row]));

    await fromRemote(async () => {
      if (linked === s.userId) {
        const local = target.rows();
        for (const row of local.days) {
          if (!remoteDays.has(row.day_index) && !held(`day:${row.day_index}`)) await applyDelete("day", row.day_index);
        }
        for (const row of local.verses) {
          if (!remoteVerses.has(row.week) && !held(`verse:${row.week}`)) await applyDelete("verse", row.week);
        }
        await applyRows(incoming);
      } else {
        await applyRows(incoming);
        const local = target.rows();
        for (const row of local.days) {
          const theirs = remoteDays.get(row.day_index);
          if (!theirs || theirs.completed_at > row.completed_at) {
            await queue.push({ kind: "put-day", row, user_id: s.userId });
            recorded.set(`day:${row.day_index}`, row);
          }
        }
        for (const row of local.verses) {
          const theirs = remoteVerses.get(row.week);
          if (!theirs || theirs.learned_at > row.learned_at) {
            await queue.push({ kind: "put-verse", row, user_id: s.userId });
            recorded.set(`verse:${row.week}`, row);
          }
        }
        linked = s.userId;
        await queue.setLinkedUser(s.userId);
      }
    });
    if (resetElsewhere) await rememberReset(remote.resetAt);

    s.reconciled = true;
    return drain(s);
  }

  async function applyChange(s: Session, change: RemoteChange) {
    await Promise.all([attachedStore().load(), linkedLoaded]);
    if (session !== s) return;
    const key = changeKey(change);
    let pending: Map<string, RemoteChange["kind"]>;
    try {
      if (unrecorded.has(key)) throw new Error("A change for this row is not queued yet");
      pending = lastPending(await queue.list(s.userId));
    } catch {
      s.reconciled = false;
      return;
    }
    const pendingKind = pending.get(key);
    if (pendingKind !== undefined && isDelete(pendingKind) !== isDelete(change.kind)) return;
    await fromRemote(() => {
      switch (change.kind) {
        case "put-day":
          return applyRows({ days: [change.row], verses: [] });
        case "put-verse":
          return applyRows({ days: [], verses: [change.row] });
        case "delete-day":
          return applyDelete("day", change.day_index);
        case "delete-verse":
          return applyDelete("verse", change.week);
        case "mark-reset":
          return Promise.resolve();
      }
    });
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
    durable: () => local.durable?.() ?? true,
    putDays: (rows) =>
      both(
        local.putDays(rows),
        rows.map((row) => record({ kind: "put-day", row }, row, dayEcho(row))),
      ),
    deleteDay: (dayIndex) =>
      both(local.deleteDay(dayIndex), [record({ kind: "delete-day", day_index: dayIndex }, "delete", `day:${dayIndex}:delete`)]),
    putVerses: (rows) =>
      both(
        local.putVerses(rows),
        rows.map((row) => record({ kind: "put-verse", row }, row, verseEcho(row))),
      ),
    deleteVerse: (week) => both(local.deleteVerse(week), [record({ kind: "delete-verse", week }, "delete", `verse:${week}:delete`)]),
  };

  return {
    persistence,

    attach(target) {
      store = target;
    },

    start(userId, remote) {
      if (session?.userId === userId && session.remote === remote) return flush();
      session?.unsubscribe();
      const s: Session = { userId, remote, reconciled: false, buffer: null, unsubscribe: () => {} };
      session = s;
      s.unsubscribe = remote.subscribe((change) => {
        if (session !== s) return;
        if (s.buffer) s.buffer.push(change);
        else void track(applyChange(s, change).catch(() => {}));
      });
      return flush();
    },

    async stop() {
      const s = session;
      session = null;
      s?.unsubscribe();
      recorded.clear();
      unrecorded.clear();
      setStatus("off");
      await linkedLoaded;
      linked = null;
      rejected = 0;
      resetSeen = null;
      notifyStatus();
      await queue.setLinkedUser(null).catch(() => {});
      await queue.setRejectedCount(0).catch(() => {});
      await queue.setResetSeen(null).catch(() => {});
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
    rejectedCount: () => rejected,
    async markReset(at) {
      await linkedLoaded;
      const userId = session?.userId ?? linked;
      if (!userId) return;
      await queue.push({ kind: "mark-reset", at, user_id: userId });
      await rememberReset(at);
      if (session) void track(flush());
    },
    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    subscribeRemote(listener) {
      remoteListeners.add(listener);
      return () => remoteListeners.delete(listener);
    },
  };
}
