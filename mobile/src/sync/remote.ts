import type { NoteRow } from '@/notes/store';
import type { DayRow } from '@/progress/store';
import type { VerseRow } from '@/verses/store';

export type RemoteChange =
  | { kind: 'put-day'; row: DayRow }
  | { kind: 'delete-day'; day_index: number }
  | { kind: 'put-verse'; row: VerseRow }
  | { kind: 'delete-verse'; week: number }
  | { kind: 'put-note'; row: NoteRow }
  | { kind: 'delete-note'; day_index: number; deleted_at: string }
  | { kind: 'mark-reset'; at: string };

export type RemoteBooks = {
  days: DayRow[];
  verses: VerseRow[];
  notes: NoteRow[];
};

export type RemotePull = RemoteBooks & { userId: string | null; resetAt: string | null };

export type RemoteAccount = {
  pull(): Promise<RemotePull>;
  putDays(rows: readonly DayRow[]): Promise<void>;
  deleteDay(dayIndex: number): Promise<void>;
  putVerses(rows: readonly VerseRow[]): Promise<void>;
  deleteVerse(week: number): Promise<void>;
  putNotes(rows: readonly NoteRow[]): Promise<void>;
  deleteNote(dayIndex: number, deletedAt: string): Promise<void>;
  markReset(at: string): Promise<string | null>;
  subscribe(onChange: (change: RemoteChange) => void, onReconnect?: () => void): () => void;
};

export function changeKey(change: RemoteChange): string {
  switch (change.kind) {
    case 'put-day':
      return `day:${change.row.day_index}`;
    case 'delete-day':
      return `day:${change.day_index}`;
    case 'put-verse':
      return `verse:${change.row.week}`;
    case 'delete-verse':
      return `verse:${change.week}`;
    case 'put-note':
      return `note:${change.row.day_index}`;
    case 'delete-note':
      return `note:${change.day_index}`;
    case 'mark-reset':
      return 'reset';
  }
}

export function sendChange(remote: RemoteAccount, change: RemoteChange): Promise<unknown> {
  switch (change.kind) {
    case 'put-day':
      return remote.putDays([change.row]);
    case 'delete-day':
      return remote.deleteDay(change.day_index);
    case 'put-verse':
      return remote.putVerses([change.row]);
    case 'delete-verse':
      return remote.deleteVerse(change.week);
    case 'put-note':
      return remote.putNotes([change.row]);
    case 'delete-note':
      return remote.deleteNote(change.day_index, change.deleted_at);
    case 'mark-reset':
      return remote.markReset(change.at);
  }
}

const DELETES = new Set<RemoteChange['kind']>(['delete-day', 'delete-verse', 'delete-note']);

export function isDelete(kind: RemoteChange['kind']): boolean {
  return DELETES.has(kind);
}

export class RemoteRefusedError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'RemoteRefusedError';
  }
}

export const isRefusal = (error: unknown): error is RemoteRefusedError => error instanceof RemoteRefusedError;
