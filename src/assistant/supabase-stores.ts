import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnswerCache } from "./cache";
import type { AuthVerifier } from "./handler";
import { utcDay, type UsageLimiter } from "./limiter";

export function supabaseLimiter(client: SupabaseClient, limit: number): UsageLimiter {
  return {
    async take(userId, now) {
      const { data, error } = await client.rpc("assistant_take_question", { p_user_id: userId, p_day: utcDay(now), p_limit: limit });
      if (error) throw new Error(`assistant_take_question failed: ${error.code ?? "unknown"}`);
      const row = (Array.isArray(data) ? data[0] : data) as { allowed?: unknown; used?: unknown } | null;
      return { allowed: row?.allowed === true, used: typeof row?.used === "number" ? row.used : limit };
    },
  };
}

export function supabaseCache(client: SupabaseClient, model: string): AnswerCache {
  return {
    async get(dayIndex, type) {
      const { data, error } = await client
        .from("assistant_answers")
        .select("answer")
        .eq("day_index", dayIndex)
        .eq("prompt_type", type)
        .maybeSingle();
      if (error) throw new Error(`assistant_answers read failed: ${error.code ?? "unknown"}`);
      return typeof data?.answer === "string" ? data.answer : null;
    },
    async set(dayIndex, type, answer) {
      const { error } = await client.from("assistant_answers").upsert({ day_index: dayIndex, prompt_type: type, answer, model });
      if (error) throw new Error(`assistant_answers write failed: ${error.code ?? "unknown"}`);
    },
  };
}

export function supabaseAuth(client: SupabaseClient): AuthVerifier {
  return {
    async userId(accessToken) {
      const { data, error } = await client.auth.getUser(accessToken);
      if (error || !data.user) return null;
      return data.user.id;
    },
  };
}
