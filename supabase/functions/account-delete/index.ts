import { createClient } from "@supabase/supabase-js";
import { accountDeleteDeps, accountDeleteResponse, type UserAdmin, type UserVerifier } from "../_shared/account/delete.ts";
import { edgeEnv } from "../_shared/env.ts";

const env = edgeEnv(Deno.env.toObject());
const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const anon: UserVerifier | null = url && anonKey ? createClient(url, anonKey, options) : null;
const admin: UserAdmin | null = url && serviceKey ? createClient(url, serviceKey, options) : null;
const deps = accountDeleteDeps(anon, admin);

Deno.serve((request) => accountDeleteResponse(request, deps, env.ASSISTANT_ALLOWED_ORIGINS ?? ""));
