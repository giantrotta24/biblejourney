import type { KeyValueStore } from '@/persist/document';

import type { RemoteChange } from './remote';

export type PendingOp = RemoteChange & { user_id: string };
export type QueuedOp = PendingOp & { id: number };

export type PendingQueue = {
  list(userId: string): Promise<QueuedOp[]>;
  push(op: PendingOp): Promise<void>;
  remove(id: number): Promise<void>;
  linkedUser(): Promise<string | null>;
  setLinkedUser(userId: string | null): Promise<void>;
  rejectedCount(): Promise<number>;
  setRejectedCount(count: number): Promise<void>;
  resetSeen(): Promise<string | null>;
  setResetSeen(at: string | null): Promise<void>;
};

export const SYNC_QUEUE_KEY = 'biblejourney.sync.v1';

type QueueFile = {
  version: 1;
  nextId: number;
  ops: QueuedOp[];
  linkedUser: string | null;
  rejectedCount: number;
  resetSeen: string | null;
};

function emptyFile(): QueueFile {
  return { version: 1, nextId: 1, ops: [], linkedUser: null, rejectedCount: 0, resetSeen: null };
}

function parseFile(raw: string): QueueFile {
  const data = JSON.parse(raw) as Partial<QueueFile>;
  if (data.version !== 1 || !Array.isArray(data.ops) || typeof data.nextId !== 'number') {
    throw new Error('Sync queue could not be read');
  }
  return {
    version: 1,
    nextId: data.nextId,
    ops: data.ops,
    linkedUser: typeof data.linkedUser === 'string' ? data.linkedUser : null,
    rejectedCount: typeof data.rejectedCount === 'number' ? data.rejectedCount : 0,
    resetSeen: typeof data.resetSeen === 'string' ? data.resetSeen : null,
  };
}

export function memoryQueue(): PendingQueue {
  const ops: QueuedOp[] = [];
  let next = 1;
  let linked: string | null = null;
  let rejected = 0;
  let resetSeen: string | null = null;
  return {
    async list(userId) {
      return ops.filter((op) => op.user_id === userId).map((op) => ({ ...op }));
    },
    async push(op) {
      ops.push({ ...op, id: next });
      next += 1;
    },
    async remove(id) {
      const at = ops.findIndex((op) => op.id === id);
      if (at >= 0) ops.splice(at, 1);
    },
    async linkedUser() {
      return linked;
    },
    async setLinkedUser(userId) {
      linked = userId;
    },
    async rejectedCount() {
      return rejected;
    },
    async setRejectedCount(count) {
      rejected = count;
    },
    async resetSeen() {
      return resetSeen;
    },
    async setResetSeen(at) {
      resetSeen = at;
    },
  };
}

export function createStorageQueue(storage: KeyValueStore): PendingQueue {
  let file: QueueFile | null = null;
  let failed = false;
  let chain: Promise<unknown> = Promise.resolve();

  function run<T>(op: () => Promise<T>): Promise<T> {
    const next = chain.then(op, op);
    chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async function hydrate(): Promise<QueueFile> {
    if (failed) throw new Error('Sync queue could not be read');
    if (file) return file;
    let raw: string | null;
    try {
      raw = await storage.getItem(SYNC_QUEUE_KEY);
    } catch (error) {
      failed = true;
      throw error;
    }
    if (raw == null) {
      file = emptyFile();
      return file;
    }
    try {
      file = parseFile(raw);
    } catch (error) {
      failed = true;
      throw error;
    }
    return file;
  }

  async function write(next: QueueFile) {
    await storage.setItem(SYNC_QUEUE_KEY, JSON.stringify(next));
    file = next;
  }

  return {
    list: (userId) =>
      run(async () => {
        const current = await hydrate();
        return current.ops.filter((op) => op.user_id === userId).map((op) => ({ ...op }));
      }),
    push: (op) =>
      run(async () => {
        const current = await hydrate();
        const queued = { ...op, id: current.nextId };
        await write({ ...current, nextId: current.nextId + 1, ops: [...current.ops, queued] });
      }),
    remove: (id) =>
      run(async () => {
        const current = await hydrate();
        await write({ ...current, ops: current.ops.filter((op) => op.id !== id) });
      }),
    linkedUser: () => run(async () => (await hydrate()).linkedUser),
    setLinkedUser: (userId) =>
      run(async () => {
        const current = await hydrate();
        await write({ ...current, linkedUser: userId });
      }),
    rejectedCount: () => run(async () => (await hydrate()).rejectedCount),
    setRejectedCount: (count) =>
      run(async () => {
        const current = await hydrate();
        await write({ ...current, rejectedCount: count });
      }),
    resetSeen: () => run(async () => (await hydrate()).resetSeen),
    setResetSeen: (at) =>
      run(async () => {
        const current = await hydrate();
        await write({ ...current, resetSeen: at });
      }),
  };
}
