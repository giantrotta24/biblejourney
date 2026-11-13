import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushMessage, ReminderDeps, ReminderStore, StoredSubscription } from "./send";

type ServerConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
};

export function reminderServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig | null {
  const config = {
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    vapidPublicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    vapidPrivateKey: env.VAPID_PRIVATE_KEY,
    vapidSubject: env.VAPID_SUBJECT,
  };
  return Object.values(config).every(Boolean) ? (config as ServerConfig) : null;
}

type ProfileRow = { user_id: string; timezone: string; reminder_time: string | null; last_reminded_on: string | null };

function supabaseReminderStore(client: SupabaseClient): ReminderStore {
  async function must<T>(query: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
    const { data, error } = await query;
    if (error) throw error;
    return data as T;
  }

  return {
    async candidates() {
      const rows = await must<ProfileRow[]>(
        client.from("profiles").select("user_id, timezone, reminder_time, last_reminded_on").not("reminder_time", "is", null),
      );
      return rows.map((row) => ({
        userId: row.user_id,
        timezone: row.timezone,
        reminderTime: row.reminder_time,
        lastRemindedOn: row.last_reminded_on,
      }));
    },
    async claim(userId, date) {
      const rows = await must<{ user_id: string }[]>(
        client
          .from("profiles")
          .update({ last_reminded_on: date })
          .eq("user_id", userId)
          .or(`last_reminded_on.is.null,last_reminded_on.lt.${date}`)
          .select("user_id"),
      );
      return rows.length > 0;
    },
    subscriptions: (userId) =>
      must<StoredSubscription[]>(client.from("push_subscriptions").select("endpoint, keys").eq("user_id", userId)),
    async completedDays(userId) {
      const rows = await must<{ day_index: number }[]>(client.from("day_progress").select("day_index").eq("user_id", userId));
      return rows.map((row) => row.day_index);
    },
    async removeSubscription(userId, endpoint) {
      await must(client.from("push_subscriptions").delete().eq("user_id", userId).eq("endpoint", endpoint));
    },
  };
}

export async function reminderDeps(config: ServerConfig): Promise<ReminderDeps> {
  const [{ createClient }, { default: webpush }] = await Promise.all([import("@supabase/supabase-js"), import("web-push")]);
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const vapidDetails = { subject: config.vapidSubject, publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey };
  return {
    store: supabaseReminderStore(client),
    now: () => new Date(),
    async push(subscription, message: PushMessage) {
      await webpush.sendNotification(subscription, JSON.stringify(message), { vapidDetails, TTL: 12 * 60 * 60, urgency: "normal" });
    },
  };
}
