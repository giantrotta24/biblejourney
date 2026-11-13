import type { SupabaseClient } from "@supabase/supabase-js";
import { DAY_COUNT, WEEK_COUNT } from "@/content/plan";
import type { DayRow, ProgressRows, VerseRow } from "@/progress/rows";
import type { RemoteChange, RemoteProgress } from "./remote";

export type ProgressTable = "day_progress" | "verse_progress";
export type ChangePayload = { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> };

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

export function realtimeChange(table: ProgressTable, payload: ChangePayload, userId: string): RemoteChange | null {
  if (payload.eventType === "DELETE") {
    const old = payload.old ?? {};
    if (old.user_id !== userId) return null;
    if (table === "day_progress") return isIndex(old.day_index, 0, DAY_COUNT - 1) ? { kind: "delete-day", day_index: old.day_index } : null;
    return isIndex(old.week, 1, WEEK_COUNT) ? { kind: "delete-verse", week: old.week } : null;
  }
  const record = payload.new ?? {};
  if (record.user_id !== userId) return null;
  if (table === "day_progress") {
    const row = dayRow(record);
    return row && { kind: "put-day", row };
  }
  const row = verseRow(record);
  return row && { kind: "put-verse", row };
}

let channelCount = 0;

export function supabaseRemote(client: SupabaseClient, userId: string): RemoteProgress {
  async function check(request: PromiseLike<{ error: unknown }>) {
    const { error } = await request;
    if (error) throw error;
  }

  return {
    async pull() {
      const [days, verses] = await Promise.all([
        client.from("day_progress").select("day_index, completed_at").eq("user_id", userId),
        client.from("verse_progress").select("week, learned_at").eq("user_id", userId),
      ]);
      if (days.error) throw days.error;
      if (verses.error) throw verses.error;
      return remoteRows(days.data ?? [], verses.data ?? []);
    },
    putDays: (rows) =>
      check(
        client.from("day_progress").upsert(
          rows.map((row) => ({ ...row, user_id: userId })),
          { onConflict: "user_id,day_index" },
        ),
      ),
    deleteDay: (dayIndex) => check(client.from("day_progress").delete().eq("user_id", userId).eq("day_index", dayIndex)),
    putVerses: (rows) =>
      check(
        client.from("verse_progress").upsert(
          rows.map((row) => ({ ...row, user_id: userId })),
          { onConflict: "user_id,week" },
        ),
      ),
    deleteVerse: (week) => check(client.from("verse_progress").delete().eq("user_id", userId).eq("week", week)),
    subscribe(onChange) {
      const channel = client.channel(`progress:${userId}:${++channelCount}`);
      for (const table of ["day_progress", "verse_progress"] as const) {
        const deliver = (payload: ChangePayload) => {
          const change = realtimeChange(table, payload, userId);
          if (change) onChange(change);
        };
        const filter = `user_id=eq.${userId}`;
        channel
          .on("postgres_changes", { event: "INSERT", schema: "public", table, filter }, deliver)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter }, deliver)
          .on("postgres_changes", { event: "DELETE", schema: "public", table }, deliver);
      }
      channel.subscribe();
      return () => {
        void client.removeChannel(channel);
      };
    },
  };
}
