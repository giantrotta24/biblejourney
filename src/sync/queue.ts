import type { RemoteChange } from "./remote";

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

const DB_NAME = "bible-journey-sync";
const DB_VERSION = 1;
const OPS = "pending_ops";
const META = "meta";
const LINKED = "linked_user";
const REJECTED = "rejected_count";
const RESET_SEEN = "reset_seen";

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
      ops.push({ ...structuredClone(op), id: next++ });
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

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OPS)) db.createObjectStore(OPS, { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new DOMException("IndexedDB upgrade blocked", "InvalidStateError"));
  });
}

function run<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  apply: (store: IDBObjectStore) => IDBRequest<T>,
  storeName = OPS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = apply(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new DOMException("Transaction aborted", "AbortError"));
  });
}

function indexedDbQueue(db: IDBDatabase): PendingQueue {
  return {
    async list(userId) {
      const all = (await run(db, "readonly", (store) => store.getAll())) as QueuedOp[];
      return all.filter((op) => op.user_id === userId).sort((a, b) => a.id - b.id);
    },
    async push(op) {
      await run(db, "readwrite", (store) => store.add(op));
    },
    async remove(id) {
      await run(db, "readwrite", (store) => store.delete(id));
    },
    async linkedUser() {
      const value = await run(db, "readonly", (store) => store.get(LINKED), META);
      return typeof value === "string" ? value : null;
    },
    async setLinkedUser(userId) {
      if (userId === null) await run(db, "readwrite", (store) => store.delete(LINKED), META);
      else await run(db, "readwrite", (store) => store.put(userId, LINKED), META);
    },
    async rejectedCount() {
      const value = await run(db, "readonly", (store) => store.get(REJECTED), META);
      return typeof value === "number" ? value : 0;
    },
    async setRejectedCount(count) {
      await run(db, "readwrite", (store) => store.put(count, REJECTED), META);
    },
    async resetSeen() {
      const value = await run(db, "readonly", (store) => store.get(RESET_SEEN), META);
      return typeof value === "string" ? value : null;
    },
    async setResetSeen(at) {
      if (at === null) await run(db, "readwrite", (store) => store.delete(RESET_SEEN), META);
      else await run(db, "readwrite", (store) => store.put(at, RESET_SEEN), META);
    },
  };
}

export function localQueue(factory: IDBFactory | null): PendingQueue {
  const ready: Promise<PendingQueue> = (async () => {
    if (!factory) return memoryQueue();
    try {
      return indexedDbQueue(await openDatabase(factory));
    } catch {
      return memoryQueue();
    }
  })();

  return {
    list: async (userId) => (await ready).list(userId),
    push: async (op) => (await ready).push(op),
    remove: async (id) => (await ready).remove(id),
    linkedUser: async () => (await ready).linkedUser(),
    setLinkedUser: async (userId) => (await ready).setLinkedUser(userId),
    rejectedCount: async () => (await ready).rejectedCount(),
    setRejectedCount: async (count) => (await ready).setRejectedCount(count),
    resetSeen: async () => (await ready).resetSeen(),
    setResetSeen: async (at) => (await ready).setResetSeen(at),
  };
}
