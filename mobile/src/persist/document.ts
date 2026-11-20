export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

export type Loaded<T> =
  | { status: 'empty' }
  | { status: 'ready'; value: T }
  | { status: 'unreadable'; raw: string }
  | { status: 'unavailable' };

/** Nothing stored, a failed read, and a payload that cannot be parsed stay distinct. */
export async function loadDocument<T>(
  storage: KeyValueStore,
  key: string,
  parse: (raw: string) => T | null,
): Promise<Loaded<T>> {
  let raw: string | null;
  try {
    raw = await storage.getItem(key);
  } catch {
    return { status: 'unavailable' };
  }
  if (raw == null) return { status: 'empty' };
  const value = parse(raw);
  if (value == null) return { status: 'unreadable', raw };
  return { status: 'ready', value };
}

/** Keeps the first unreadable copy, then writes. A thrown write is the caller's to retry. */
export async function saveDocument(
  storage: KeyValueStore,
  key: string,
  serialized: string,
  backupKey: string,
  backupRaw?: string | null,
): Promise<void> {
  if (backupRaw != null) {
    const existing = await storage.getItem(backupKey);
    if (existing == null) await storage.setItem(backupKey, backupRaw);
  }
  await storage.setItem(key, serialized);
}
