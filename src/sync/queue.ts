import type { RemoteChange } from "./remote";

export type PendingOp = RemoteChange & { user_id: string };
export type QueuedOp = PendingOp & { id: number };

export type PendingQueue = {
  list(userId: string): Promise<QueuedOp[]>;
  push(op: PendingOp): Promise<void>;
  remove(id: number): Promise<void>;
  linkedUser(): Promise<string | null>;
  setLinkedUser(userId: string | null): Promise<void>;
};

const DB_NAME = "bible-journey-sync";
const DB_VERSION = 1;
const OPS = "pending_ops";
const META = "meta";
const LINKED = "linked_user";

export function memoryQueue(): PendingQueue {
  const ops: QueuedOp[] = [];
  let next = 1;
  let linked: string | null = null;
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
      await run(db, "readwrite", (store) => (userId === null ? store.delete(LINKED) : store.put(userId, LINKED)), META);
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
  };
}
