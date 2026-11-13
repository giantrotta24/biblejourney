export const DEFAULT_ASSISTANT_MODEL = "claude-sonnet-5-5";

type Env = Record<string, string | undefined>;

export type AssistantSetup = { ready: boolean; missing: string[]; anonymous: boolean };

export function assistantModelId(env: Env): string {
  return env.ANTHROPIC_MODEL?.trim() || DEFAULT_ASSISTANT_MODEL;
}

export function anonymousAllowed(env: Env): boolean {
  return env.ASSISTANT_ALLOW_ANONYMOUS === "1" && env.NODE_ENV !== "production";
}

export function assistantSetup(env: Env): AssistantSetup {
  const anonymous = anonymousAllowed(env);
  const required = ["ANTHROPIC_API_KEY"];
  if (env.NODE_ENV === "production") required.push("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  else if (!anonymous) required.push("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const missing = required.filter((name) => !env[name]?.trim());
  return { ready: missing.length === 0, missing, anonymous };
}
