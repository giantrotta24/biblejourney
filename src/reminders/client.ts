"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { accountsConfigured, supabaseClient } from "@/account/supabase";
import { registerServiceWorker } from "@/pwa/service-worker";
import { readerTimeZone } from "@/settings/client";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export const remindersConfigured = accountsConfigured && Boolean(vapidPublicKey);

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function applicationServerKey(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function client(): Promise<SupabaseClient> {
  const supabase = await supabaseClient();
  if (!supabase) throw new Error("Accounts are not set up");
  return supabase;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (!existing) await registerServiceWorker();
  return navigator.serviceWorker.ready;
}

async function must(query: PromiseLike<{ error: unknown }>) {
  const { error } = await query;
  if (error) throw error;
}

export async function deviceSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const existing = await navigator.serviceWorker.getRegistration("/");
  return (await existing?.pushManager.getSubscription()) ?? null;
}

export async function accountReminderTime(userId: string): Promise<string | null> {
  const { data, error } = await (await client())
    .from("profiles")
    .select("reminder_time")
    .eq("user_id", userId)
    .maybeSingle<{ reminder_time: string | null }>();
  if (error) throw error;
  return data?.reminder_time?.slice(0, 5) ?? null;
}

export type EnableResult = "on" | "denied";

export async function enableReminders(userId: string, time: string): Promise<EnableResult> {
  if (!vapidPublicKey) throw new Error("Reminders are not set up");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const reg = await registration();
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(vapidPublicKey) }));
  const json = subscription.toJSON();
  const supabase = await client();
  await must(
    supabase
      .from("push_subscriptions")
      .upsert({ user_id: userId, endpoint: subscription.endpoint, keys: json.keys }, { onConflict: "user_id,endpoint" }),
  );
  await must(supabase.from("profiles").upsert({ user_id: userId, reminder_time: time, timezone: readerTimeZone() }, { onConflict: "user_id" }));
  return "on";
}

export async function changeReminderTime(userId: string, time: string) {
  await must((await client()).from("profiles").update({ reminder_time: time, timezone: readerTimeZone() }).eq("user_id", userId));
}

export async function disableReminders(userId: string) {
  const supabase = await client();
  const subscription = await deviceSubscription();
  if (subscription) {
    await must(supabase.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", subscription.endpoint));
    await subscription.unsubscribe().catch(() => false);
  }
  const { count, error } = await supabase.from("push_subscriptions").select("endpoint", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw error;
  if (!count) await must(supabase.from("profiles").update({ reminder_time: null }).eq("user_id", userId));
}
