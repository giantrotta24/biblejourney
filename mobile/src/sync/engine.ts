import type { SyncStore } from './memory-store';
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

export type Sync = {
  attach(store: SyncStore): void;
  start(userId: string, remote: RemoteAccount): Promise<void>;
  stop(): Promise<void>;
  flush(): Promise<void>;
  resync(): Promise<void>;
  idle(): Promise<void>;
  recordLocal(change: RemoteChange): Promise<void>;
  userId(): string | null;
  getStatus(): SyncStatus;
  rejectedCount(): number;
  subscribeStatus(listener: () => void): () => void;
  subscribeRemote(listener: () => void): () => void;
};

type Session = {
  userId: string;
  remote: RemoteAccount;
  reconciled: boolean;
  buffer: RemoteChange[] | null;
  unsubscribe: () => void;
};

function lastPending(ops: readonly QueuedOp[]): Map<string, RemoteChange['kind']> {
  const last = new Map<string, RemoteChange['kind']>();
  for (const op of ops) last.set(changeKey(op), op.kind);
  return last;
}

export function createSync(queue: PendingQueue, options?: { debounceMs?: number }): Sync {
  const debounceMs = options?.debounceMs ?? 1000;
  let session: Session | null = null;
  let store: SyncStore | null = null;
  let status: SyncStatus = 'off';
  let linked: string | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  let rejected = 0;
  let resetSeen: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const statusListeners = new Set<() => void>();
  const remoteListeners = new Set<() => void>();
  const unrecorded = new Set<string>();
  const inflight = new Set<Promise<unknown>>();

  const linkedLoaded = Promise.all([
    queue.resetSeen().then(
      (value) => {
        resetSeen ??= value;
      },
      () => undefined,
    ),
    queue.linkedUser().then(
      (value) => {
        linked ??= value;
      },
      () => undefined,
    ),
    queue.rejectedCount().then(
      (value) => {
        rejected += value;
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

  async function addRejected() {
    rejected += 1;
    notifyStatus();
    await queue.setRejectedCount(rejected).catch(() => undefined);
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

  async function applyBooks(rows: RemoteBooks) {
    const target = attached();
    await target.mergeDays(rows.days);
    await target.mergeVerses(rows.verses);
    await target.mergeNotes(rows.notes);
  }

  async function applyDelete(kind: 'day' | 'verse' | 'note', key: number) {
    const target = attached();
    const present =
      kind === 'day'
        ? target.rows().days.some((row) => row.day_index === key)
        : kind === 'verse'
          ? target.rows().verses.some((row) => row.week === key)
          : target.rows().notes.some((row) => row.day_index === key);
    if (!present) return;
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
        }
      } catch (error) {
        if (!isRefusal(error)) return false;
        await addRejected();
      }
      await queue.remove(op.id);
    }
    return true;
  }

  async function applySnapshot(s: Session): Promise<boolean> {
    const target = attached();
    const loaded = await target.load();
    await linkedLoaded;
    if (!loaded || session !== s) return false;
    if (!(await drain(s)) || session !== s) return false;

    const remote = await s.remote.pull();
    if (session !== s || remote.userId !== s.userId) return false;

    const pending = lastPending(await queue.list(s.userId));
    const held = (key: string) => pending.has(key) || unrecorded.has(key);
    const blocked = (key: string) => {
      const kind = pending.get(key);
      return unrecorded.has(key) || (kind !== undefined && isDelete(kind));
    };
    const current = target.rows();
    const removableProgress =
      current.days.some((row) => !held(`day:${row.day_index}`)) || current.verses.some((row) => !held(`verse:${row.week}`));
    const removableNotes = current.notes.some((row) => !held(`note:${row.day_index}`));
    const progressEmpty = remote.days.length === 0 && remote.verses.length === 0;
    const notesEmpty = remote.notes.length === 0;
    const resetElsewhere = remote.resetAt !== null && remote.resetAt !== resetSeen;
    if (
      linked === s.userId &&
      !resetElsewhere &&
      ((progressEmpty && removableProgress) || (progressEmpty && notesEmpty && removableNotes))
    ) {
      return false;
    }

    const incoming: RemoteBooks = {
      days: remote.days.filter((row) => !blocked(`day:${row.day_index}`)),
      verses: remote.verses.filter((row) => !blocked(`verse:${row.week}`)),
      notes: remote.notes.filter((row) => !blocked(`note:${row.day_index}`)),
    };
    const remoteDays = new Map(remote.days.map((row) => [row.day_index, row]));
    const remoteVerses = new Map(remote.verses.map((row) => [row.week, row]));
    const remoteNotes = new Map(remote.notes.map((row) => [row.day_index, row]));

    await fromRemote(async () => {
      if (linked === s.userId) {
        const local = target.rows();
        for (const row of local.days) {
          if (!remoteDays.has(row.day_index) && !held(`day:${row.day_index}`)) await applyDelete('day', row.day_index);
        }
        for (const row of local.verses) {
          if (!remoteVerses.has(row.week) && !held(`verse:${row.week}`)) await applyDelete('verse', row.week);
        }
        if (!resetElsewhere) {
          for (const row of local.notes) {
            if (!remoteNotes.has(row.day_index) && !held(`note:${row.day_index}`)) await applyDelete('note', row.day_index);
          }
        }
        await applyBooks(incoming);
      } else {
        await applyBooks(incoming);
        const local = target.rows();
        for (const row of local.days) {
          const theirs = remoteDays.get(row.day_index);
          if (!theirs || theirs.completed_at > row.completed_at) await queue.push({ kind: 'put-day', row, user_id: s.userId });
        }
        for (const row of local.verses) {
          const theirs = remoteVerses.get(row.week);
          if (!theirs || theirs.learned_at > row.learned_at) await queue.push({ kind: 'put-verse', row, user_id: s.userId });
        }
        for (const row of local.notes) {
          const theirs = remoteNotes.get(row.day_index);
          if (!theirs || theirs.updated_at < row.updated_at) await queue.push({ kind: 'put-note', row, user_id: s.userId });
        }
        linked = s.userId;
        await queue.setLinkedUser(s.userId);
      }
    });
    if (resetElsewhere) await rememberReset(remote.resetAt);
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
    const target = attached();
    if (!(await target.load()) || session !== s) return;
    const key = changeKey(change);
    let pending: Map<string, RemoteChange['kind']>;
    try {
      if (unrecorded.has(key)) throw new Error('A change for this row is not queued yet');
      pending = lastPending(await queue.list(s.userId));
    } catch {
      s.reconciled = false;
      return;
    }
    const pendingKind = pending.get(key);
    if (pendingKind !== undefined && isDelete(pendingKind) !== isDelete(change.kind)) return;
    await fromRemote(() => {
      switch (change.kind) {
        case 'put-day':
          return applyBooks({ days: [change.row], verses: [], notes: [] });
        case 'put-verse':
          return applyBooks({ days: [], verses: [change.row], notes: [] });
        case 'put-note':
          return applyBooks({ days: [], verses: [], notes: [change.row] });
        case 'delete-day':
          return applyDelete('day', change.day_index);
        case 'delete-verse':
          return applyDelete('verse', change.week);
        case 'delete-note':
          return applyDelete('note', change.day_index);
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
          let ok = false;
          try {
            ok = s.reconciled ? await drain(s) : await reconcile(s);
          } catch {
            ok = false;
          }
          if (session !== s) continue;
          setStatus(ok ? 'synced' : 'offline');
          if (!ok) break;
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
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, debounceMs);
  }

  return {
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
        else void track(applyChange(s, change).catch(() => undefined));
      });
      return flush();
    },

    async stop() {
      const s = session;
      session = null;
      s?.unsubscribe();
      if (timer) clearTimeout(timer);
      timer = null;
      unrecorded.clear();
      setStatus('off');
      await linkedLoaded;
      linked = null;
      rejected = 0;
      resetSeen = null;
      notifyStatus();
      await queue.setLinkedUser(null).catch(() => undefined);
      await queue.setRejectedCount(0).catch(() => undefined);
      await queue.setResetSeen(null).catch(() => undefined);
    },

    flush,
    resync() {
      if (session) session.reconciled = false;
      return flush();
    },

    async idle() {
      while (inflight.size > 0) await Promise.all([...inflight]);
    },

    async recordLocal(change) {
      await linkedLoaded;
      const userId = session?.userId ?? linked;
      if (!userId) {
        unrecorded.delete(changeKey(change));
        return;
      }
      try {
        await queue.push({ ...change, user_id: userId });
      } catch (error) {
        unrecorded.add(changeKey(change));
        throw error;
      }
      unrecorded.delete(changeKey(change));
      if (session) {
        setStatus('syncing');
        scheduleFlush();
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
  };
}
