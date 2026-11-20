import { DAY_COUNT, WEEK_COUNT } from '../../../supabase/functions/_shared/content/plan';
import type { NoteRow } from '@/notes/store';
import type { DayRow } from '@/progress/store';
import type { VerseRow } from '@/verses/store';

import { RemoteRefusedError, type RemoteAccount, type RemoteBooks, type RemoteChange } from './remote';

export type BroadcastPayload = {
  table?: unknown;
  operation?: unknown;
  record?: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
};

type QueryResult = { data: unknown; error: unknown; status: number };
type Filter = {
  select: (columns: string) => Filter;
  eq: (column: string, value: string | number) => Filter & PromiseLike<QueryResult>;
  upsert: (rows: unknown[], options: { onConflict: string }) => PromiseLike<{ error: unknown; status: number }>;
  delete: () => Filter;
  maybeSingle: () => PromiseLike<QueryResult>;
};

export type SyncClient = {
  from: (table: string) => Filter;
  rpc: (fn: string) => PromiseLike<QueryResult>;
  auth: { getSession: () => Promise<{ data: { session: { user: { id: string } } | null } }> };
  realtime: { setAuth: () => Promise<void> };
  channel: (
    name: string,
    options: { config: { private: boolean } },
  ) => {
    on: (
      type: 'broadcast',
      filter: { event: string },
      callback: (message: { payload?: BroadcastPayload }) => void,
    ) => void;
    subscribe: () => void;
  };
  removeChannel: (channel: unknown) => Promise<unknown>;
};

const isIndex = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

function isoTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? null : time.toISOString();
}

function dayRow(record: Record<string, unknown>): DayRow | null {
  const completed_at = isoTime(record.completed_at);
  return isIndex(record.day_index, 0, DAY_COUNT - 1) && completed_at
    ? { day_index: record.day_index, completed_at }
    : null;
}

function verseRow(record: Record<string, unknown>): VerseRow | null {
  const learned_at = isoTime(record.learned_at);
  return isIndex(record.week, 1, WEEK_COUNT) && learned_at ? { week: record.week, learned_at } : null;
}

function noteRow(record: Record<string, unknown>): NoteRow | null {
  const updated_at = isoTime(record.updated_at);
  if (!isIndex(record.day_index, 0, DAY_COUNT - 1) || !updated_at) return null;
  if (typeof record.body !== 'string' || record.body.length === 0) return null;
  return { day_index: record.day_index, body: record.body, updated_at };
}

const present = <T>(value: T | null): value is T => value !== null;

export function remoteRows(days: unknown[], verses: unknown[], notes: unknown[]): RemoteBooks {
  return {
    days: (days as Record<string, unknown>[]).map(dayRow).filter(present),
    verses: (verses as Record<string, unknown>[]).map(verseRow).filter(present),
    notes: (notes as Record<string, unknown>[]).map(noteRow).filter(present),
  };
}

export const progressTopic = (userId: string) => `progress:${userId}`;

export function broadcastChange(payload: BroadcastPayload | null | undefined, userId: string): RemoteChange | null {
  if (!payload) return null;
  const { table, operation } = payload;
  if (table !== 'day_progress' && table !== 'verse_progress' && table !== 'notes') return null;
  if (operation === 'DELETE') {
    const old = payload.old_record ?? {};
    if (old.user_id !== userId) return null;
    if (table === 'day_progress') {
      return isIndex(old.day_index, 0, DAY_COUNT - 1) ? { kind: 'delete-day', day_index: old.day_index } : null;
    }
    if (table === 'verse_progress') {
      return isIndex(old.week, 1, WEEK_COUNT) ? { kind: 'delete-verse', week: old.week } : null;
    }
    return isIndex(old.day_index, 0, DAY_COUNT - 1) ? { kind: 'delete-note', day_index: old.day_index } : null;
  }
  if (operation !== 'INSERT' && operation !== 'UPDATE') return null;
  const record = payload.record ?? {};
  if (record.user_id !== userId) return null;
  if (table === 'day_progress') {
    const row = dayRow(record);
    return row && { kind: 'put-day', row };
  }
  if (table === 'verse_progress') {
    const row = verseRow(record);
    return row && { kind: 'put-verse', row };
  }
  const row = noteRow(record);
  return row && { kind: 'put-note', row };
}

export class SessionMissingError extends Error {
  constructor() {
    super('No session for this account');
    this.name = 'SessionMissingError';
  }
}

const RETRYABLE = new Set([401, 408, 429]);

export function remoteError(error: unknown, status: number): unknown {
  if (status < 400 || status >= 500 || RETRYABLE.has(status)) return error;
  const message = error instanceof Object && 'message' in error ? String(error.message) : `Request refused (${status})`;
  return new RemoteRefusedError(message, status);
}

export function canSync(client: unknown): client is SyncClient {
  return typeof client === 'object' && client !== null && typeof (client as { from?: unknown }).from === 'function';
}

export function supabaseRemote(client: SyncClient, userId: string): RemoteAccount {
  async function signedIn() {
    const { data } = await client.auth.getSession();
    if (data.session?.user.id !== userId) throw new SessionMissingError();
  }

  async function check(request: () => PromiseLike<{ error: unknown; status: number }>) {
    await signedIn();
    const { error, status } = await request();
    if (error) throw remoteError(error, status);
  }

  return {
    async pull() {
      await signedIn();
      const [days, verses, notes, profile] = await Promise.all([
        client.from('day_progress').select('day_index, completed_at').eq('user_id', userId),
        client.from('verse_progress').select('week, learned_at').eq('user_id', userId),
        client.from('notes').select('day_index, body, updated_at').eq('user_id', userId),
        client.from('profiles').select('progress_reset_at').eq('user_id', userId).maybeSingle(),
      ]);
      if (days.error) throw remoteError(days.error, days.status);
      if (verses.error) throw remoteError(verses.error, verses.status);
      if (notes.error) throw remoteError(notes.error, notes.status);
      if (profile.error) throw remoteError(profile.error, profile.status);
      const reset = profile.data as { progress_reset_at?: unknown } | null;
      return {
        ...remoteRows(days.data as unknown[], verses.data as unknown[], notes.data as unknown[]),
        userId,
        resetAt: isoTime(reset?.progress_reset_at),
      };
    },
    putDays: (rows) =>
      check(() =>
        client.from('day_progress').upsert(
          rows.map((row) => ({ ...row, user_id: userId })),
          { onConflict: 'user_id,day_index' },
        ),
      ),
    deleteDay: (dayIndex) => check(() => client.from('day_progress').delete().eq('user_id', userId).eq('day_index', dayIndex)),
    putVerses: (rows) =>
      check(() =>
        client.from('verse_progress').upsert(
          rows.map((row) => ({ ...row, user_id: userId })),
          { onConflict: 'user_id,week' },
        ),
      ),
    deleteVerse: (week) => check(() => client.from('verse_progress').delete().eq('user_id', userId).eq('week', week)),
    putNotes: (rows) =>
      check(() =>
        client.from('notes').upsert(
          rows.map((row) => ({ ...row, user_id: userId })),
          { onConflict: 'user_id,day_index' },
        ),
      ),
    deleteNote: (dayIndex) => check(() => client.from('notes').delete().eq('user_id', userId).eq('day_index', dayIndex)),
    async markReset() {
      await signedIn();
      const { data, error, status } = await client.rpc('reset_progress');
      if (error) throw remoteError(error, status);
      return isoTime(data);
    },
    subscribe(onChange) {
      const channel = client.channel(progressTopic(userId), { config: { private: true } });
      channel.on('broadcast', { event: '*' }, (message: { payload?: BroadcastPayload }) => {
        const change = broadcastChange(message.payload, userId);
        if (change) onChange(change);
      });
      let closed = false;
      void client.realtime.setAuth().then(
        () => {
          if (!closed) channel.subscribe();
        },
        () => undefined,
      );
      return () => {
        closed = true;
        void client.removeChannel(channel);
      };
    },
  };
}
