import type { NoteRow } from '@/notes/store';
import type { KeyValueStore } from '@/persist/document';
import type { DayRow } from '@/progress/store';
import type { VerseRow } from '@/verses/store';

import type { PendingQueue, QueuedOp } from './queue';
import {
  changeKey,
  isDelete,
  isRefusal,
  sendChange,
  type RemoteAccount,
  type RemoteBooks,
  type RemoteChange,
} from './remote';

export type SyncStatus = 'off' | 'syncing' | 'synced' | 'offline';

export type SyncStore = {
  load(): Promise<boolean>;
  rows(): RemoteBooks;
  getSnapshot(): unknown;
  mergeDays(rows: readonly DayRow[]): Promise<void>;
  mergeVerses(rows: readonly VerseRow[]): Promise<void>;
  mergeNotes(rows: readonly NoteRow[]): Promise<void>;
  removeDay(dayIndex: number): Promise<void>;
  removeVerse(week: number): Promise<void>;
  removeNote(dayIndex: number): Promise<void>;
};

export type Sync = {
  attach(store: SyncStore): void;
  start(userId: string, remote: RemoteAccount): Promise<void>;
  stop(): Promise<void>;
  pause(): void;
  flush(): Promise<void>;
  resync(): Promise<void>;
  idle(): Promise<void>;
  recordLocal(change: RemoteChange): Promise<void>;
  userId(): string | null;
  getStatus(): SyncStatus;
  rejectedCount(): number;
  subscribeStatus(listener: () => void): () => void;
  subscribeRemote(listener: () => void): () => void;
  onFirstLink(listener: () => void): () => void;
};

type Session = {
  userId: string;
  remote: RemoteAccount;
  reconciled: boolean;
  buffer: RemoteChange[] | null;
  unsubscribe: () => void;
};

const UNRECORDED_KEY = 'biblejourney.sync.unrecorded';
const RETRY_MIN_MS = 5000;
const RETRY_MAX_MS = 60000;

type UnrecordedFile = { userId: string | null; changes: RemoteChange[] };

function lastPending(ops: readonly QueuedOp[]): Map<string, QueuedOp> {
  const last = new Map<string, QueuedOp>();
  for (const op of ops) {
    if (op.kind === 'mark-reset') continue;
    last.set(changeKey(op), op);
  }
  return last;
}

export function createSync(
  queue: PendingQueue,
  options?: { debounceMs?: number; unrecordedStore?: KeyValueStore },
): Sync {
  const debounceMs = options?.debounceMs ?? 1000;
  const unrecordedStore = options?.unrecordedStore;
  let session: Session | null = null;
  let store: SyncStore | null = null;
  let status: SyncStatus = 'off';
  let linked: string | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  let rejected = 0;
  let resetSeen: string | null = null;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = RETRY_MIN_MS;
  let stopping: Promise<void> | null = null;
  const refused = new Set<number>();
  const statusListeners = new Set<() => void>();
  const remoteListeners = new Set<() => void>();
  const firstLinkListeners = new Set<() => void>();
  const unrecorded = new Set<string>();
  const recording = new Set<string>();
  const failedChanges = new Map<string, RemoteChange>();
  const inflight = new Set<Promise<unknown>>();

  const linkedLoaded = Promise.all([
    queue.resetSeen().then(
      (value) => {
        resetSeen ??= value;
      },
      () => undefined,
    ),
    queue.linkedUser().then(
      async (value) => {
        linked ??= value;
        await loadUnrecorded();
      },
      () => undefined,
    ),
    queue.rejectedCount().then(
      (value) => {
        rejected += value;
      },
      () => undefined,
    ),
    queue.refusedNotes().then(
      (values) => {
        for (const day of values) refused.add(day);
      },
      () => undefined,
    ),
  ]);

  function notifyStatus() {
    for (const listener of statusListeners) listener();
  }

  function setStatus(next: SyncStatus) {
    if (status === next) return;
    status = next;
    notifyStatus();
  }

  function track<T>(promise: Promise<T>): Promise<T> {
    const settled = promise.then(
      () => undefined,
      () => undefined,
    );
    inflight.add(settled);
    void settled.then(() => inflight.delete(settled));
    return promise;
  }

  function attached(): SyncStore {
    if (!store) throw new Error('Sync has no store attached');
    return store;
  }

  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function clearRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    retryDelay = RETRY_MIN_MS;
  }

  function scheduleRetry() {
    if (retryTimer || !session) return;
    const delay = retryDelay;
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    const handle = setTimeout(() => {
      retryTimer = null;
      if (!session || status !== 'offline') return;
      void resync();
    }, delay);
    retryTimer = handle;
    (handle as { unref?: () => void }).unref?.();
  }

  async function loadUnrecorded() {
    if (!unrecordedStore || !linked) return;
    let raw: string | null;
    try {
      raw = await unrecordedStore.getItem(UNRECORDED_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as Partial<UnrecordedFile>;
      if (data.userId !== linked || !Array.isArray(data.changes)) return;
      for (const change of data.changes) {
        if (!change || typeof change !== 'object' || !('kind' in change)) continue;
        const key = changeKey(change);
        unrecorded.add(key);
        failedChanges.set(key, change);
      }
    } catch {
      return;
    }
  }

  async function persistUnrecorded() {
    if (!unrecordedStore) return;
    const file: UnrecordedFile = {
      userId: session?.userId ?? linked,
      changes: [...failedChanges.values()],
    };
    await unrecordedStore.setItem(UNRECORDED_KEY, JSON.stringify(file)).catch(() => undefined);
  }

  async function retryUnrecorded(userId: string) {
    if (failedChanges.size === 0) return;
    for (const [key, change] of [...failedChanges]) {
      try {
        await queue.push({ ...change, user_id: userId });
        failedChanges.delete(key);
        unrecorded.delete(key);
      } catch {
        break;
      }
    }
    await persistUnrecorded();
  }

  async function addRejected() {
    rejected += 1;
    notifyStatus();
    await queue.setRejectedCount(rejected).catch(() => undefined);
  }

  async function rememberRefused(dayIndex: number) {
    if (refused.has(dayIndex)) return;
    refused.add(dayIndex);
    await queue.addRefusedNote(dayIndex).catch(() => undefined);
  }

  async function rememberReset(at: string | null) {
    resetSeen = at;
    await queue.setResetSeen(at).catch(() => undefined);
  }

  async function fromRemote(apply: () => Promise<void>) {
    const before = attached().getSnapshot();
    await apply();
    if (attached().getSnapshot() === before) return;
    for (const listener of remoteListeners) listener();
  }

  async function applyBooks(rows: RemoteBooks, ok: () => boolean) {
    if (!ok()) return;
    const target = attached();
    await target.mergeDays(rows.days);
    if (!ok()) return;
    await target.mergeVerses(rows.verses);
    if (!ok()) return;
    await target.mergeNotes(rows.notes);
  }

  async function applyDelete(kind: 'day' | 'verse' | 'note', key: number, ok: () => boolean) {
    if (!ok()) return;
    const target = attached();
    const present =
      kind === 'day'
        ? target.rows().days.some((row) => row.day_index === key)
        : kind === 'verse'
          ? target.rows().verses.some((row) => row.week === key)
          : target.rows().notes.some((row) => row.day_index === key);
    if (!present || !ok()) return;
    if (kind === 'day') await target.removeDay(key);
    else if (kind === 'verse') await target.removeVerse(key);
    else await target.removeNote(key);
  }

  async function drain(s: Session): Promise<boolean> {
    for (const op of await queue.list(s.userId)) {
      if (session !== s) return false;
      try {
        if (op.kind === 'mark-reset') {
          const stamped = await s.remote.markReset(op.at);
          if (stamped) await rememberReset(stamped);
        } else {
          await sendChange(s.remote, op);
          if (op.kind === 'delete-note') {
            s.reconciled = false;
            again = true;
          }
          if (op.kind === 'put-note' && refused.delete(op.row.day_index)) {
            await queue.setRefusedNotes([...refused]).catch(() => undefined);
          }
        }
      } catch (error) {
        if (!isRefusal(error)) return false;
        await addRejected();
        if (op.kind === 'put-note') await rememberRefused(op.row.day_index);
      }
      await queue.remove(op.id);
    }
    return true;
  }

  async function applySnapshot(s: Session): Promise<boolean> {
    const gen = generation;
    const ok = () => generation === gen && session === s;
    const target = attached();
    const loaded = await target.load();
    await linkedLoaded;
    if (!loaded || !ok()) return false;
    if (!(await drain(s)) || !ok()) return false;

    const remote = await s.remote.pull();
    if (!ok() || remote.userId !== s.userId) return false;

    const pending = lastPending(await queue.list(s.userId));
    const held = (key: string) => pending.has(key) || unrecorded.has(key) || recording.has(key);
    const blocked = (key: string, updatedAt?: string) => {
      if (unrecorded.has(key) || recording.has(key)) return true;
      const op = pending.get(key);
      if (!op || !isDelete(op.kind)) return false;
      if (op.kind === 'delete-note' && updatedAt !== undefined && updatedAt > op.deleted_at) return false;
      return true;
    };
    const current = target.rows();
    const removableProgress =
      current.days.some((row) => !held(`day:${row.day_index}`)) ||
      current.verses.some((row) => !held(`verse:${row.week}`));
    const removableNotes = current.notes.some((row) => !held(`note:${row.day_index}`) && !refused.has(row.day_index));
    const progressEmpty = remote.days.length === 0 && remote.verses.length === 0;
    const notesEmpty = remote.notes.length === 0;
    const resetElsewhere = remote.resetAt !== null && remote.resetAt !== resetSeen;
    if (linked === s.userId && !resetElsewhere && progressEmpty && (removableProgress || (notesEmpty && removableNotes))) {
      return false;
    }

    const incoming: RemoteBooks = {
      days: remote.days.filter((row) => !blocked(`day:${row.day_index}`)),
      verses: remote.verses.filter((row) => !blocked(`verse:${row.week}`)),
      notes: remote.notes.filter((row) => !blocked(`note:${row.day_index}`, row.updated_at)),
    };
    const remoteDays = new Map(remote.days.map((row) => [row.day_index, row]));
    const remoteVerses = new Map(remote.verses.map((row) => [row.week, row]));
    const remoteNotes = new Map(remote.notes.map((row) => [row.day_index, row]));

    await fromRemote(async () => {
      if (!ok()) return;
      if (linked === s.userId) {
        const local = target.rows();
        for (const row of local.days) {
          if (!ok()) return;
          if (!remoteDays.has(row.day_index) && !held(`day:${row.day_index}`)) await applyDelete('day', row.day_index, ok);
        }
        for (const row of local.verses) {
          if (!ok()) return;
          if (!remoteVerses.has(row.week) && !held(`verse:${row.week}`)) await applyDelete('verse', row.week, ok);
        }
        for (const row of local.notes) {
          if (!ok()) return;
          if (!remoteNotes.has(row.day_index) && !held(`note:${row.day_index}`) && !refused.has(row.day_index)) {
            await applyDelete('note', row.day_index, ok);
          }
        }
        if (!ok()) return;
        await applyBooks(incoming, ok);
      } else {
        if (!ok()) return;
        await applyBooks(incoming, ok);
        if (!ok()) return;
        const local = target.rows();
        for (const row of local.days) {
          if (!ok()) return;
          const theirs = remoteDays.get(row.day_index);
          if (!theirs || theirs.completed_at > row.completed_at) await queue.push({ kind: 'put-day', row, user_id: s.userId });
        }
        for (const row of local.verses) {
          if (!ok()) return;
          const theirs = remoteVerses.get(row.week);
          if (!theirs || theirs.learned_at > row.learned_at) await queue.push({ kind: 'put-verse', row, user_id: s.userId });
        }
        for (const row of local.notes) {
          if (!ok()) return;
          const theirs = remoteNotes.get(row.day_index);
          if (!theirs || theirs.updated_at < row.updated_at) await queue.push({ kind: 'put-note', row, user_id: s.userId });
        }
        if (!ok()) return;
        linked = s.userId;
        await queue.setLinkedUser(s.userId);
        if (!ok()) return;
        for (const listener of firstLinkListeners) listener();
      }
    });
    if (!ok()) return false;
    if (resetElsewhere) await rememberReset(remote.resetAt);
    if (!ok()) return false;
    s.reconciled = true;
    return drain(s);
  }

  async function reconcile(s: Session): Promise<boolean> {
    s.buffer ??= [];
    try {
      return await applySnapshot(s);
    } finally {
      const buffered = s.buffer ?? [];
      s.buffer = null;
      for (const change of buffered) await applyChange(s, change).catch(() => undefined);
    }
  }

  async function applyChange(s: Session, change: RemoteChange) {
    const gen = generation;
    const ok = () => generation === gen && session === s;
    const target = attached();
    if (!(await target.load()) || !ok()) return;
    const key = changeKey(change);
    let pending: Map<string, QueuedOp>;
    try {
      if (unrecorded.has(key) || recording.has(key)) throw new Error('A change for this row is not queued yet');
      pending = lastPending(await queue.list(s.userId));
    } catch {
      s.reconciled = false;
      return;
    }
    const pendingOp = pending.get(key);
    if (pendingOp && isDelete(pendingOp.kind) !== isDelete(change.kind)) {
      const newerNote =
        pendingOp.kind === 'delete-note' && change.kind === 'put-note' && change.row.updated_at > pendingOp.deleted_at;
      if (!newerNote) return;
    }
    if (!ok()) return;
    await fromRemote(() => {
      if (!ok()) return Promise.resolve();
      switch (change.kind) {
        case 'put-day':
          return applyBooks({ days: [change.row], verses: [], notes: [] }, ok);
        case 'put-verse':
          return applyBooks({ days: [], verses: [change.row], notes: [] }, ok);
        case 'put-note':
          return applyBooks({ days: [], verses: [], notes: [change.row] }, ok);
        case 'delete-day':
          return applyDelete('day', change.day_index, ok);
        case 'delete-verse':
          return applyDelete('verse', change.week, ok);
        case 'delete-note':
          return applyDelete('note', change.day_index, ok);
        case 'mark-reset':
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
          setStatus('syncing');
          await retryUnrecorded(s.userId);
          let ok = false;
          try {
            ok = s.reconciled ? await drain(s) : await reconcile(s);
          } catch {
            ok = false;
          }
          if (session !== s) continue;
          if (again || (ok && !s.reconciled)) {
            again = true;
            continue;
          }
          if (ok) clearRetry();
          setStatus(ok ? 'synced' : 'offline');
          if (!ok) {
            scheduleRetry();
            break;
          }
        } while (again);
      } finally {
        running = null;
      }
    })();
    return track(running);
  }

  function scheduleFlush() {
    if (!session) return;
    if (running) {
      again = true;
      return;
    }
    if (debounceMs <= 0) {
      void flush();
      return;
    }
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, debounceMs);
  }

  function resync(): Promise<void> {
    if (session) session.reconciled = false;
    return flush();
  }

  return {
    attach(target) {
      store = target;
    },

    start(userId, remote) {
      if (session?.userId === userId && session.remote === remote) return flush();
      generation += 1;
      session?.unsubscribe();
      clearTimer();
      const s: Session = { userId, remote, reconciled: false, buffer: null, unsubscribe: () => {} };
      session = s;
      s.unsubscribe = remote.subscribe(
        (change) => {
          if (session !== s) return;
          if (s.buffer) s.buffer.push(change);
          else void track(applyChange(s, change).catch(() => undefined));
        },
        () => {
          if (session !== s) return;
          void resync();
        },
      );
      return flush();
    },

    async stop() {
      if (stopping) return stopping;
      generation += 1;
      const s = session;
      session = null;
      s?.unsubscribe();
      clearTimer();
      clearRetry();
      recording.clear();
      unrecorded.clear();
      failedChanges.clear();
      setStatus('off');
      stopping = (async () => {
        await linkedLoaded;
        linked = null;
        rejected = 0;
        resetSeen = null;
        refused.clear();
        notifyStatus();
        await queue.setLinkedUser(null).catch(() => undefined);
        await queue.setRejectedCount(0).catch(() => undefined);
        await queue.setResetSeen(null).catch(() => undefined);
        await queue.setRefusedNotes([]).catch(() => undefined);
        await persistUnrecorded();
      })();
      try {
        await stopping;
      } finally {
        stopping = null;
      }
    },

    pause() {
      const s = session;
      session = null;
      s?.unsubscribe();
      clearTimer();
      clearRetry();
      recording.clear();
    },

    flush,
    resync,

    async idle() {
      while (inflight.size > 0) await Promise.all([...inflight]);
    },

    async recordLocal(change) {
      const key = changeKey(change);
      recording.add(key);
      try {
        await linkedLoaded;
        const userId = session?.userId ?? linked;
        if (!userId) {
          unrecorded.delete(key);
          failedChanges.delete(key);
          return;
        }
        try {
          await queue.push({ ...change, user_id: userId });
        } catch (error) {
          unrecorded.add(key);
          failedChanges.set(key, change);
          await persistUnrecorded();
          throw error;
        }
        unrecorded.delete(key);
        if (failedChanges.delete(key)) await persistUnrecorded();
        if (session) {
          setStatus('syncing');
          scheduleFlush();
        }
      } finally {
        recording.delete(key);
      }
    },

    userId: () => session?.userId ?? null,
    getStatus: () => status,
    rejectedCount: () => rejected,
    subscribeStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    subscribeRemote(listener) {
      remoteListeners.add(listener);
      return () => remoteListeners.delete(listener);
    },
    onFirstLink(listener) {
      firstLinkListeners.add(listener);
      return () => firstLinkListeners.delete(listener);
    },
  };
}
