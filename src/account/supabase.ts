import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const accountsConfigured = Boolean(url && anonKey);

let client: Promise<SupabaseClient> | null = null;

export function supabaseClient(): Promise<SupabaseClient | null> {
  if (!url || !anonKey || typeof window === "undefined") return Promise.resolve(null);
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
    }),
  );
  return client;
}

export async function getAccessToken(): Promise<string | null> {
  const supabase = await supabaseClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export function authRedirectUrl(): string {
  return new URL("/account", window.location.origin).toString();
}
