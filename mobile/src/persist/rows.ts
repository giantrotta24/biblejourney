const VERSION = 1;

/** Shared envelope for row documents. Null means the payload is unreadable. */
export function parseVersionedRows(raw: string): unknown[] | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const record = data as { version?: unknown; rows?: unknown };
  if (record.version !== VERSION || !Array.isArray(record.rows)) return null;
  return record.rows;
}

export function serializeVersionedRows(rows: readonly unknown[]): string {
  return JSON.stringify({ version: VERSION, rows });
}
