import type { SupabaseClient } from "@supabase/supabase-js";
import { DAY_COUNT, WEEK_COUNT } from "@/content/plan";
import type { DayRow, ProgressRows, VerseRow } from "@/progress/rows";
import { RemoteRefusedError, type RemoteChange, type RemoteProgress } from "./remote";

export type ProgressTable = "day_progress" | "verse_progress";
export type BroadcastPayload = {
  table?: unknown;
  operation?: unknown;
  record?: Record<string, unknown> | null;
  old_record?: Record<string, unknown> | null;
};

const isIndex = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

function isoTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? null : time.toISOString();
}

function dayRow(record: Record<string, unknown>): DayRow | null {
  const completed_at = isoTime(record.completed_at);
  return isIndex(record.day_index, 0, DAY_COUNT - 1) && completed_at ? { day_index: record.day_index, completed_at } : null;
}

function verseRow(record: Record<string, unknown>): VerseRow | null {
  const learned_at = isoTime(record.learned_at);
  return isIndex(record.week, 1, WEEK_COUNT) && learned_at ? { week: record.week, learned_at } : null;
}

const present = <T>(value: T | null): value is T => value !== null;

export function remoteRows(days: unknown[], verses: unknown[]): ProgressRows {
  return {
    days: (days as Record<string, unknown>[]).map(dayRow).filter(present),
    verses: (verses as Record<string, unknown>[]).map(verseRow).filter(present),
  };
}

export const progressTopic = (userId: string) => `progress:${userId}`;

export function broadcastChange(payload: BroadcastPayload | null | undefined, userId: string): RemoteChange | null {
  if (!payload) return null;
  const { table, operation } = payload;
  if (table !== "day_progress" && table !== "verse_progress") return null;
  if (operation === "DELETE") {
    const old = payload.old_record ?? {};
    if (old.user_id !== userId) return null;
    if (table === "day_progress") return isIndex(old.day_index, 0, DAY_COUNT - 1) ? { kind: "delete-day", day_index: old.day_index } : null;
    return isIndex(old.week, 1, WEEK_COUNT) ? { kind: "delete-verse", week: old.week } : null;
  }
  if (operation !== "INSERT" && operation !== "UPDATE") return null;
  const record = payload.record ?? {};
  if (record.user_id !== userId) return null;
  if (table === "day_progress") {
    const row = dayRow(record);
    return row && { kind: "put-day", row };
  }
  const row = verseRow(record);
  return row && { kind: "put-verse", row };
}

export class SessionMissingError extends Error {
  constructor() {
    super("No session for this account");
    this.name = "SessionMissingError";
  }
}

const RETRYABLE = new Set([401, 408, 429]);

export function remoteError(error: unknown, status: number): unknown {
  if (status < 400 || status >= 500 || RETRYABLE.has(status)) return error;
  const message = error instanceof Object && "message" in error ? String(error.message) : `Request refused (${status})`;
  return new RemoteRefusedError(message, status);
}

export function supabaseRemote(client: SupabaseClient, userId: string): RemoteProgress {
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
      const [days, verses, profile] = await Promise.all([
        client.from("day_progress").select("day_index, completed_at").eq("user_id", userId),
        client.from("verse_progress").select("week, learned_at").eq("user_id", userId),
        client.from("profiles").select("progress_reset_at").eq("user_id", userId).maybeSingle<{ progress_reset_at: unknown }>(),
      ]);
      if (days.error) throw remoteError(days.error, days.status);
      if (verses.error) throw remoteError(verses.error, verses.status);
      if (profile.error) throw remoteError(profile.error, profile.status);
      return { ...remoteRows(days.data ?? [], verses.data ?? []), userId, resetAt: isoTime(profile.data?.progress_reset_at) };
    },
    putDays: (rows) =>
      check(() =>
        client.from("day_progress").upsert(
          rows.map((row) => ({ ...row, user_id: userId })),
          { onConflict: "user_id,day_index" },
        ),
      ),
    deleteDay: (dayIndex) => check(() => client.from("day_progress").delete().eq("user_id", userId).eq("day_index", dayIndex)),
    putVerses: (rows) =>
      check(() =>
        client.from("verse_progress").upsert(
          rows.map((row) => ({ ...row, user_id: userId })),
          { onConflict: "user_id,week" },
        ),
      ),
    deleteVerse: (week) => check(() => client.from("verse_progress").delete().eq("user_id", userId).eq("week", week)),
    markReset: (at) =>
      check(() => client.from("profiles").upsert({ user_id: userId, progress_reset_at: at }, { onConflict: "user_id" })),
    subscribe(onChange) {
      const channel = client.channel(progressTopic(userId), { config: { private: true } });
      channel.on("broadcast", { event: "*" }, (message: { payload?: BroadcastPayload }) => {
        const change = broadcastChange(message.payload, userId);
        if (change) onChange(change);
      });
      let closed = false;
      void client.realtime.setAuth().then(
        () => {
          if (!closed) channel.subscribe();
        },
        () => {},
      );
      return () => {
        closed = true;
        void client.removeChannel(channel);
      };
    },
  };
}
