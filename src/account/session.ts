"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useSyncExternalStore } from "react";
import { progressSync } from "@/progress/client";
import type { SyncStatus } from "@/sync/engine";
import { supabaseRemote } from "@/sync/supabase-remote";
import { syncAction } from "./follow";
import { accountsConfigured, authRedirectUrl, supabaseClient } from "./supabase";

export type AccountState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; userId: string; email: string | null };

const INITIAL: AccountState = accountsConfigured ? { status: "loading" } : { status: "unconfigured" };

let state: AccountState = INITIAL;
let started = false;
const listeners = new Set<() => void>();

function setState(next: AccountState) {
  state = next;
  for (const listener of listeners) listener();
}

function follow(client: SupabaseClient, event: string, session: Session | null) {
  const sync = progressSync();
  const user = session?.user ?? null;
  const action = syncAction(event, user?.id ?? null, sync.userId());
  if (action === "stop") void sync.stop();
  if (user) {
    setState({ status: "signed-in", userId: user.id, email: user.email ?? null });
    if (action === "start") void sync.start(user.id, supabaseRemote(client, user.id));
    return;
  }
  setState({ status: "signed-out" });
}

export function startAccounts() {
  if (started || !accountsConfigured) return;
  started = true;
  void supabaseClient().then((client) => {
    if (!client) return;
    client.auth.onAuthStateChange((event, session) => {
      setTimeout(() => follow(client, event, session), 0);
    });
    const resync = () => void progressSync().resync();
    window.addEventListener("online", resync);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") resync();
    });
  });
}

async function requireClient(): Promise<SupabaseClient> {
  const client = await supabaseClient();
  if (!client) throw new Error("Accounts are not set up");
  return client;
}

export async function signInWithEmail(email: string) {
  const { error } = await (await requireClient()).auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirectUrl() } });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const { error } = await (await requireClient()).auth.signInWithOAuth({ provider: "google", options: { redirectTo: authRedirectUrl() } });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await (await requireClient()).auth.signOut({ scope: "local" });
  if (error) throw error;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAccount(): AccountState {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (listener) => progressSync().subscribeStatus(listener),
    () => progressSync().getStatus(),
    () => "off",
  );
}

export function useRejectedChanges(): number {
  return useSyncExternalStore(
    (listener) => progressSync().subscribeStatus(listener),
    () => progressSync().rejectedCount(),
    () => 0,
  );
}
