import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { isRefusal } from "./remote";
import { broadcastChange, progressTopic, remoteError, remoteRows, supabaseRemote } from "./supabase-remote";

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
});

describe("private broadcast changes", () => {
  const base = { id: "1", schema: "public" };

  it("uses one private topic per user", () => {
    expect(progressTopic(ME)).toBe("progress:me");
  });

  it("turns this user's inserts, updates and deletes into changes", () => {
    expect(
      broadcastChange(
        { ...base, table: "day_progress", operation: "INSERT", record: { user_id: ME, day_index: 3, completed_at: "2026-11-13T12:00:00+00:00" }, old_record: null },
        ME,
      ),
    ).toEqual({ kind: "put-day", row: { day_index: 3, completed_at: "2026-11-13T12:00:00.000Z" } });
    expect(
      broadcastChange(
        {
          ...base,
          table: "verse_progress",
          operation: "UPDATE",
          record: { user_id: ME, week: 5, learned_at: "2026-11-13T12:00:00+00:00" },
          old_record: { user_id: ME, week: 5, learned_at: "2026-11-13T13:00:00+00:00" },
        },
        ME,
      ),
    ).toEqual({ kind: "put-verse", row: { week: 5, learned_at: "2026-11-13T12:00:00.000Z" } });
    expect(
      broadcastChange(
        { ...base, table: "day_progress", operation: "DELETE", record: null, old_record: { user_id: ME, day_index: 3, completed_at: "2026-11-13T12:00:00+00:00" } },
        ME,
      ),
    ).toEqual({ kind: "delete-day", day_index: 3 });
    expect(
      broadcastChange({ ...base, table: "verse_progress", operation: "DELETE", record: null, old_record: { user_id: ME, week: 5 } }, ME),
    ).toEqual({ kind: "delete-verse", week: 5 });
  });

  it("ignores changes for another user, other tables, or malformed rows", () => {
    expect(broadcastChange({ ...base, table: "day_progress", operation: "DELETE", record: null, old_record: { user_id: "other", day_index: 3 } }, ME)).toBeNull();
    expect(broadcastChange({ ...base, table: "profiles", operation: "INSERT", record: { user_id: ME }, old_record: null }, ME)).toBeNull();
    expect(
      broadcastChange({ ...base, table: "day_progress", operation: "INSERT", record: { user_id: ME, day_index: 400, completed_at: "2026-11-13T12:00:00Z" }, old_record: null }, ME),
    ).toBeNull();
    expect(broadcastChange({ ...base, table: "verse_progress", operation: "INSERT", record: { user_id: ME, week: 2 }, old_record: null }, ME)).toBeNull();
    expect(broadcastChange(null, ME)).toBeNull();
  });
});

describe("Supabase error classes", () => {
  const error = { message: "nope", code: "42501", details: "", hint: "" };

  it("treats constraint, permission and conflict errors as refusals", () => {
    for (const status of [400, 403, 404, 409, 422]) expect(isRefusal(remoteError(error, status))).toBe(true);
  });

  it("treats network, auth, rate-limit and server errors as worth retrying", () => {
    for (const status of [0, 401, 408, 429, 500, 502, 503]) expect(isRefusal(remoteError(error, status))).toBe(false);
  });
});

function fakeClient(sessionUser: string | null, profile: Record<string, unknown> | null = null) {
  const result = { data: [], error: null, status: 200 };
  const query = {
    select: vi.fn(() => query),
    maybeSingle: vi.fn(() => Promise.resolve({ data: profile, error: null, status: 200 })),
    eq: vi.fn(() => query),
    upsert: vi.fn(() => query),
    delete: vi.fn(() => query),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  const from = vi.fn(() => query);
  const rpc = vi.fn(async () => ({ data: "2026-11-13T12:30:00.5+00:00", error: null, status: 200 }));
  const client = {
    rpc,
    auth: { getSession: async () => ({ data: { session: sessionUser ? { user: { id: sessionUser } } : null }, error: null }) },
    from,
  } as unknown as SupabaseClient;
  return { client, from, rpc };
}

describe("Supabase remote session guard", () => {
  it("refuses to read or write without a session for this user, as a retryable error", async () => {
    for (const sessionUser of [null, "someone-else"]) {
      const { client, from } = fakeClient(sessionUser);
      const remote = supabaseRemote(client, ME);
      for (const call of [
        () => remote.pull(),
        () => remote.putDays([{ day_index: 1, completed_at: "2026-11-13T12:00:00.000Z" }]),
        () => remote.deleteDay(1),
        () => remote.putVerses([{ week: 1, learned_at: "2026-11-13T12:00:00.000Z" }]),
        () => remote.deleteVerse(1),
        () => remote.markReset("2026-11-13T12:00:00.000Z"),
      ]) {
        const error = await call().then(
          () => null,
          (reason: unknown) => reason,
        );
        expect(error).toBeInstanceOf(Error);
        expect(isRefusal(error)).toBe(false);
      }
      expect(from).not.toHaveBeenCalled();
    }
  });

  it("reads as the signed-in user and says so", async () => {
    const { client, from } = fakeClient(ME);
    await expect(supabaseRemote(client, ME).pull()).resolves.toEqual({ days: [], verses: [], userId: ME, resetAt: null });
    expect(from).toHaveBeenCalledTimes(3);
  });

  it("returns the account's last reset time with the pull, as an ISO time", async () => {
    const { client } = fakeClient(ME, { progress_reset_at: "2026-11-13T12:30:00.123+00:00" });
    await expect(supabaseRemote(client, ME).pull()).resolves.toMatchObject({ resetAt: "2026-11-13T12:30:00.123Z" });
  });

  it("resets the whole account in one server call and returns the server's reset time", async () => {
    const { client, rpc, from } = fakeClient(ME);
    await expect(supabaseRemote(client, ME).markReset("2026-11-13T12:00:00.000Z")).resolves.toBe("2026-11-13T12:30:00.500Z");
    expect(rpc).toHaveBeenCalledWith("reset_progress");
    expect(from).not.toHaveBeenCalled();
  });
});
