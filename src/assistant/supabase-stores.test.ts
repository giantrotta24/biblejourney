import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { supabaseAuth, supabaseCache, supabaseLimiter } from "./supabase-stores";

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

describe("supabaseCache", () => {
  it("reads and writes answers keyed by day index and prompt type", async () => {
    const { client, calls } = fakeClient({ data: { answer: "Cached" }, error: null });
    const cache = supabaseCache(client, "claude-sonnet-5-5");
    expect(await cache.get(7, "map")).toBe("Cached");
    await cache.set(7, "map", "New");
    expect(calls).toContainEqual(["eq", "day_index", 7]);
    expect(calls).toContainEqual(["eq", "prompt_type", "map"]);
    expect(calls).toContainEqual(["upsert", { day_index: 7, prompt_type: "map", answer: "New", model: "claude-sonnet-5-5" }]);
  });
});

describe("supabaseAuth", () => {
  it("returns the user id for a valid token and null otherwise", async () => {
    expect(await supabaseAuth(fakeClient({ data: { user: { id: "u1" } }, error: null }).client).userId("t")).toBe("u1");
    expect(await supabaseAuth(fakeClient({ data: { user: null }, error: { message: "bad jwt" } }).client).userId("t")).toBeNull();
  });
});
