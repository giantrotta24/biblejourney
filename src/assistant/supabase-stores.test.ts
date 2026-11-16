import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { supabaseAccess, supabaseAuth, supabaseCache, supabaseFlags, supabaseLimiter, supabaseReports } from "./supabase-stores";

function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: unknown[][] = [];
  const query = {
    select: (...args: unknown[]) => (calls.push(["select", ...args]), query),
    eq: (...args: unknown[]) => (calls.push(["eq", ...args]), query),
    maybeSingle: async () => result,
    upsert: async (...args: unknown[]) => (calls.push(["upsert", ...args]), result),
  };
  const client = {
    rpc: async (...args: unknown[]) => (calls.push(["rpc", ...args]), result),
    from: (...args: unknown[]) => (calls.push(["from", ...args]), query),
    auth: { getUser: async (...args: unknown[]) => (calls.push(["getUser", ...args]), result) },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("supabaseLimiter", () => {
  it("takes a question through the RPC with the UTC day", async () => {
    const { client, calls } = fakeClient({ data: [{ allowed: true, used: 4 }], error: null });
    expect(await supabaseLimiter(client, 30).take("u1", new Date("2026-11-13T23:30:00-05:00"))).toEqual({ allowed: true, used: 4 });
    expect(calls).toEqual([["rpc", "assistant_take_question", { p_user_id: "u1", p_day: "2026-11-14", p_limit: 30 }]]);
  });

  it("refuses when the RPC says so and throws on an error", async () => {
    expect(await supabaseLimiter(fakeClient({ data: [{ allowed: false, used: 30 }], error: null }).client, 30).take("u1", new Date())).toEqual({
      allowed: false,
      used: 30,
    });
    await expect(supabaseLimiter(fakeClient({ data: null, error: { code: "42501" } }).client, 30).take("u1", new Date())).rejects.toThrow("42501");
  });
});

describe("supabaseAccess", () => {
  it("looks up only the verified user in assistant_access", async () => {
    const { client, calls } = fakeClient({ data: { user_id: "u1" }, error: null });
    expect(await supabaseAccess(client).allowed("u1")).toBe(true);
    expect(calls).toEqual([["from", "assistant_access"], ["select", "user_id"], ["eq", "user_id", "u1"]]);
  });

  it("denies a missing or unexpected row", async () => {
    for (const data of [null, {}, { user_id: "someone-else" }]) {
      expect(await supabaseAccess(fakeClient({ data, error: null }).client).allowed("u1")).toBe(false);
    }
  });

  it("throws on lookup failure even if a row is also returned", async () => {
    const { client } = fakeClient({ data: { user_id: "u1" }, error: { code: "42501", message: "private detail" } });
    await expect(supabaseAccess(client).allowed("u1")).rejects.toThrow("42501");
  });
});

describe("supabaseLimiter release", () => {
  it("gives a question back through the RPC", async () => {
    const { client, calls } = fakeClient({ data: null, error: null });
    await supabaseLimiter(client, 30).release("u1", new Date("2026-11-13T12:00:00Z"));
    expect(calls).toEqual([["rpc", "assistant_release_question", { p_user_id: "u1", p_day: "2026-11-13" }]]);
  });
});

describe("supabaseCache", () => {
  it("reads and writes answers keyed by day index, prompt type, model and prompt version", async () => {
    const { client, calls } = fakeClient({ data: { answer: "Cached" }, error: null });
    const cache = supabaseCache(client);
    const key = { dayIndex: 7, type: "map" as const, model: "claude-sonnet-5-5", promptVersion: "2026-11-13" };
    expect(await cache.get(key)).toBe("Cached");
    await cache.set(key, "New");
    expect(calls).toContainEqual(["eq", "day_index", 7]);
    expect(calls).toContainEqual(["eq", "prompt_type", "map"]);
    expect(calls).toContainEqual(["eq", "model", "claude-sonnet-5-5"]);
    expect(calls).toContainEqual(["eq", "prompt_version", "2026-11-13"]);
    expect(calls).toContainEqual([
      "upsert",
      { day_index: 7, prompt_type: "map", model: "claude-sonnet-5-5", prompt_version: "2026-11-13", answer: "New" },
    ]);
  });
});

function tableClient(result: { data?: unknown; error: { code?: string } | null; count?: number | null }) {
  const calls: unknown[][] = [];
  const query = {
    select: (...args: unknown[]) => (calls.push(["select", ...args]), query),
    eq: (...args: unknown[]) => (calls.push(["eq", ...args]), query),
    gte: (...args: unknown[]) => (calls.push(["gte", ...args]), query),
    lt: async (...args: unknown[]) => (calls.push(["lt", ...args]), result),
    insert: async (...args: unknown[]) => (calls.push(["insert", ...args]), result),
  };
  const client = { from: (...args: unknown[]) => (calls.push(["from", ...args]), query) };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("assistant safety migration", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261115000000_assistant_safety.sql", import.meta.url), "utf8");

  it("stores flags and reports under the same lockdown as assistant access", () => {
    expect(sql.toLowerCase()).toContain("create table if not exists public.assistant_flags");
    expect(sql.toLowerCase()).toContain("create table if not exists public.assistant_reports");
    expect(sql.toLowerCase()).toContain("id bigint generated always as identity primary key");
    expect(sql).toMatch(/category text not null check \(category in \('off_topic', 'inappropriate', 'manipulation', 'crisis', 'withheld'\)\)/);
    expect(sql).toMatch(/kind text not null check \(kind in \('question', 'history', 'map', 'people'\)\)/);
    for (const table of ["assistant_flags", "assistant_reports"]) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on public.${table} from anon, authenticated`);
      expect(sql).toContain(`grant all on public.${table} to service_role`);
    }
    const flags = sql.slice(sql.toLowerCase().indexOf("assistant_flags"), sql.toLowerCase().indexOf("assistant_reports"));
    expect(flags).not.toMatch(/question|answer/);
    expect(flags).toMatch(/user_id uuid/);
  });
});

describe("supabaseFlags", () => {
  it("writes a category and day, and no question or answer text", async () => {
    const { client, calls } = tableClient({ error: null });
    await supabaseFlags(client).write({ userId: null, dayIndex: 4, category: "crisis" });
    expect(calls).toContainEqual(["from", "assistant_flags"]);
    expect(calls).toContainEqual(["insert", { user_id: null, day_index: 4, category: "crisis" }]);
    expect(JSON.stringify(calls)).not.toMatch(/question|answer/);
  });

  it("throws the error code when the write fails", async () => {
    const { client } = tableClient({ error: { code: "42501" } });
    await expect(supabaseFlags(client).write({ userId: "u1", dayIndex: 1, category: "off_topic" })).rejects.toThrow("42501");
  });
});

describe("supabaseReports", () => {
  it("counts a reader’s reports for the UTC day and inserts the row", async () => {
    const { client, calls } = tableClient({ error: null, count: 3 });
    const reports = supabaseReports(client);
    expect(await reports.count("u1", new Date("2026-11-13T23:30:00-05:00"))).toBe(3);
    await reports.write({
      userId: "u1",
      dayIndex: 8,
      kind: "question",
      question: "Why a flood?",
      answer: "The story is about judgment.",
      note: null,
      model: "claude-sonnet-5-5",
      promptVersion: "2026-11-15",
    });
    expect(calls).toContainEqual(["from", "assistant_reports"]);
    expect(calls).toContainEqual(["eq", "user_id", "u1"]);
    expect(calls).toContainEqual(["gte", "created_at", "2026-11-14T00:00:00.000Z"]);
    expect(calls).toContainEqual(["lt", "created_at", "2026-11-15T00:00:00.000Z"]);
    expect(calls).toContainEqual([
      "insert",
      {
        user_id: "u1",
        day_index: 8,
        kind: "question",
        question: "Why a flood?",
        answer: "The story is about judgment.",
        note: null,
        model: "claude-sonnet-5-5",
        prompt_version: "2026-11-15",
      },
    ]);
  });

  it("throws the error code when the count fails", async () => {
    const { client } = tableClient({ error: { code: "42501" }, count: 0 });
    await expect(supabaseReports(client).count("u1", new Date("2026-11-14T00:00:00Z"))).rejects.toThrow("42501");
  });
});

describe("supabaseAuth", () => {
  it("returns the user id for a valid token and null otherwise", async () => {
    expect(await supabaseAuth(fakeClient({ data: { user: { id: "u1" } }, error: null }).client).userId("t")).toBe("u1");
    expect(await supabaseAuth(fakeClient({ data: { user: null }, error: { message: "bad jwt" } }).client).userId("t")).toBeNull();
  });
});
