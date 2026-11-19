type Env = Record<string, string | undefined>;

export function edgeEnv(env: Env): Env {
  return {
    ...env,
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: env.VAPID_PUBLIC_KEY,
  };
}
