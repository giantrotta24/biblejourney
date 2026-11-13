import { createClient } from "@supabase/supabase-js";
import { memoryCache } from "./cache";
import { anonymousAllowed, assistantModelId } from "./config";
import type { AskDeps } from "./handler";
import { memoryLimiter } from "./limiter";
import { anthropicModel } from "./model";
import { supabaseAuth, supabaseCache, supabaseLimiter } from "./supabase-stores";
import { DAILY_QUESTION_LIMIT } from "./types";

const memory = {
  limiter: memoryLimiter(DAILY_QUESTION_LIMIT),
  anonymousLimiter: memoryLimiter(DAILY_QUESTION_LIMIT),
  cache: memoryCache(),
};

const serverClientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

let deps: AskDeps | null = null;

export function serverAskDeps(): AskDeps {
  if (deps) return deps;
  const env = process.env;
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  const modelId = assistantModelId(env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const service = url && serviceKey ? createClient(url, serviceKey, serverClientOptions) : null;

  deps = {
    model: apiKey ? anthropicModel({ apiKey, model: modelId }) : null,
    auth: url && anonKey ? supabaseAuth(createClient(url, anonKey, serverClientOptions)) : null,
    allowAnonymous: anonymousAllowed(env),
    limiter: service ? supabaseLimiter(service, DAILY_QUESTION_LIMIT) : memory.limiter,
    anonymousLimiter: memory.anonymousLimiter,
    cache: service ? supabaseCache(service, modelId) : memory.cache,
  };
  return deps;
}
