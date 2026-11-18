import { expect, it } from "vitest";
import { edgeEnv } from "./env.ts";
import { assistantSetup } from "./assistant/config.ts";
import { reminderServerConfig } from "./reminders/server.ts";

it("maps injected Supabase and VAPID names and forces production", () => {
  const env = edgeEnv({ NODE_ENV: "development", ASSISTANT_ALLOW_ANONYMOUS: "1", SUPABASE_URL: "https://project.example", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service", VAPID_PUBLIC_KEY: "public", VAPID_PRIVATE_KEY: "private", VAPID_SUBJECT: "mailto:test@example.com", ANTHROPIC_API_KEY: "test", CRON_SECRET: "cron" });
  expect(env.NODE_ENV).toBe("production");
  expect(assistantSetup(env)).toEqual({ ready: true, missing: [], anonymous: false });
  expect(reminderServerConfig(env)).toEqual({ supabaseUrl: "https://project.example", serviceRoleKey: "service", vapidPublicKey: "public", vapidPrivateKey: "private", vapidSubject: "mailto:test@example.com" });
  expect(env.CRON_SECRET).toBe("cron");
});

it("fails closed when only a model key and the local anonymous flag exist", () => {
  const env = edgeEnv({ ANTHROPIC_API_KEY: "test", ASSISTANT_ALLOW_ANONYMOUS: "1" });
  expect(assistantSetup(env)).toEqual({ ready: false, anonymous: false, missing: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] });
  expect(reminderServerConfig(env)).toBeNull();
});
