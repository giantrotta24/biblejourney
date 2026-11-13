import type { DayRow, ProgressPersistence, ProgressRows, VerseRow } from "./rows";

const DB_NAME = "bible-journey";
const DB_VERSION = 1;
const DAYS = "day_progress";
const VERSES = "verse_progress";

const emptyRows = (): ProgressRows => ({ days: [], verses: [] });

export function memoryPersistence(): ProgressPersistence {
  const days = new Map<number, DayRow>();
  const verses = new Map<number, VerseRow>();
  return {
    async load() {
      return { days: [...days.values()], verses: [...verses.values()] };
    },
    async putDays(rows) {
      for (const row of rows) days.set(row.day_index, row);
    },
    async deleteDay(dayIndex) {
      days.delete(dayIndex);
    },
    async putVerses(rows) {
      for (const row of rows) verses.set(row.week, row);
    },
    async deleteVerse(week) {
      verses.delete(week);
    },
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new DOMException("Transaction aborted", "AbortError"));
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DAYS)) db.createObjectStore(DAYS, { keyPath: "day_index" });
      if (!db.objectStoreNames.contains(VERSES)) db.createObjectStore(VERSES, { keyPath: "week" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new DOMException("IndexedDB upgrade blocked", "InvalidStateError"));
  });
}

function indexedDbPersistence(db: IDBDatabase): ProgressPersistence {
  async function write(storeName: string, apply: (store: IDBObjectStore) => void) {
    const transaction = db.transaction(storeName, "readwrite");
    apply(transaction.objectStore(storeName));
    await transactionDone(transaction);
  }

  return {
    async load() {
      const transaction = db.transaction([DAYS, VERSES], "readonly");
      const [days, verses] = await Promise.all([
        requestResult(transaction.objectStore(DAYS).getAll() as IDBRequest<DayRow[]>),
        requestResult(transaction.objectStore(VERSES).getAll() as IDBRequest<VerseRow[]>),
      ]);
      return { days, verses };
    },
    putDays: (rows) => write(DAYS, (store) => rows.forEach((row) => store.put(row))),
    deleteDay: (dayIndex) => write(DAYS, (store) => store.delete(dayIndex)),
    putVerses: (rows) => write(VERSES, (store) => rows.forEach((row) => store.put(row))),
    deleteVerse: (week) => write(VERSES, (store) => store.delete(week)),
  };
}

export function localPersistence(factory: IDBFactory | null): ProgressPersistence {
  const ready: Promise<ProgressPersistence> = (async () => {
    if (!factory) return memoryPersistence();
    try {
      return indexedDbPersistence(await openDatabase(factory));
    } catch {
      return memoryPersistence();
    }
  })();

  return {
    async load() {
      try {
        return await (await ready).load();
      } catch {
        return emptyRows();
      }
    },
    putDays: async (rows) => (await ready).putDays(rows),
    deleteDay: async (dayIndex) => (await ready).deleteDay(dayIndex),
    putVerses: async (rows) => (await ready).putVerses(rows),
    deleteVerse: async (week) => (await ready).deleteVerse(week),
  };
}
