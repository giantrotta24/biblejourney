import { describe, expect, it } from "vitest";
import { realtimeChange, remoteRows } from "./supabase-remote";

const ME = "me";

describe("Supabase row mapping", () => {
  it("normalizes Postgres timestamps to the ISO form the device stores", () => {
    expect(
      remoteRows(
        [{ day_index: 4, completed_at: "2026-11-13T12:00:00+00:00" }],
        [{ week: 2, learned_at: "2026-11-13T07:30:00.5-05:00" }],
      ),
    ).toEqual({
      days: [{ day_index: 4, completed_at: "2026-11-13T12:00:00.000Z" }],
      verses: [{ week: 2, learned_at: "2026-11-13T12:30:00.500Z" }],
    });
  });

  it("turns this user's inserts, updates and deletes into changes", () => {
    expect(
      realtimeChange("day_progress", { eventType: "INSERT", new: { user_id: ME, day_index: 3, completed_at: "2026-11-13T12:00:00+00:00" }, old: {} }, ME),
    ).toEqual({ kind: "put-day", row: { day_index: 3, completed_at: "2026-11-13T12:00:00.000Z" } });
    expect(
      realtimeChange("verse_progress", { eventType: "UPDATE", new: { user_id: ME, week: 5, learned_at: "2026-11-13T12:00:00+00:00" }, old: {} }, ME),
    ).toEqual({ kind: "put-verse", row: { week: 5, learned_at: "2026-11-13T12:00:00.000Z" } });
    expect(realtimeChange("day_progress", { eventType: "DELETE", new: {}, old: { user_id: ME, day_index: 3 } }, ME)).toEqual({
      kind: "delete-day",
      day_index: 3,
    });
    expect(realtimeChange("verse_progress", { eventType: "DELETE", new: {}, old: { user_id: ME, week: 5 } }, ME)).toEqual({
      kind: "delete-verse",
      week: 5,
    });
  });

  it("ignores changes that belong to someone else or are malformed", () => {
    expect(realtimeChange("day_progress", { eventType: "DELETE", new: {}, old: { user_id: "other", day_index: 3 } }, ME)).toBeNull();
    expect(realtimeChange("day_progress", { eventType: "DELETE", new: {}, old: { day_index: 3 } }, ME)).toBeNull();
    expect(realtimeChange("day_progress", { eventType: "INSERT", new: { user_id: ME, day_index: 400, completed_at: "2026-11-13T12:00:00Z" }, old: {} }, ME)).toBeNull();
    expect(realtimeChange("verse_progress", { eventType: "INSERT", new: { user_id: ME, week: 2 }, old: {} }, ME)).toBeNull();
  });
});
