import { createClient } from "@supabase/supabase-js";
import { memoryAccess } from "./access";
import { memoryCache } from "./cache";
import { assistantModelId, assistantSetup, screenModelId } from "./config";
import { memoryFlags } from "./flags";
import { consoleLog, type AskDeps, type AssistantLog } from "./handler";
import { memoryLimiter } from "./limiter";
import { anthropicModel } from "./model";
import { memoryReports } from "./reports";
import { anthropicSafety } from "./screen";
import { supabaseAccess, supabaseAuth, supabaseCache, supabaseFlags, supabaseLimiter, supabaseReports } from "./supabase-stores";
import { DAILY_QUESTION_LIMIT } from "./types";

type Env = Record<string, string | undefined>;

const serverClientOptions = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export function createAskDeps(env: Env, log: AssistantLog): AskDeps {
  const setup = assistantSetup(env);
  const modelId = assistantModelId(env);
  const screenId = screenModelId(env);
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!setup.ready) {
    const event = { event: "assistant.not_configured", missing: setup.missing.join(",") };
    if (apiKey) log.error(event);
    else log.info(event);
  }

  const service = setup.ready && url && serviceKey ? createClient(url, serviceKey, serverClientOptions) : null;

  return {
    model: setup.ready && apiKey ? anthropicModel({ apiKey, model: modelId }) : null,
    screen: setup.ready && apiKey ? anthropicSafety({ apiKey, model: screenId }) : null,
    flags: service ? supabaseFlags(service) : memoryFlags(),
    reports: service ? supabaseReports(service) : env.NODE_ENV === "production" ? null : memoryReports(),
    auth: url && anonKey ? supabaseAuth(createClient(url, anonKey, serverClientOptions)) : null,
    access: service ? supabaseAccess(service) : memoryAccess(env.NODE_ENV === "development" ? "everyone" : []),
    allowAnonymous: setup.anonymous,
    limiter: service ? supabaseLimiter(service, DAILY_QUESTION_LIMIT) : memoryLimiter(DAILY_QUESTION_LIMIT),
    anonymousLimiter: memoryLimiter(DAILY_QUESTION_LIMIT),
    cache: service ? supabaseCache(service) : memoryCache(),
    modelId,
    log,
  };
}

let deps: AskDeps | null = null;

export function serverAskDeps(): AskDeps {
  deps ??= createAskDeps(process.env, consoleLog);
  return deps;
}
