import { edgeEnv } from "../_shared/env.ts";
import { handleReminderRequest } from "../_shared/reminders/send.ts";
import { reminderDeps, reminderServerConfig } from "../_shared/reminders/server.ts";
import { createPush } from "./push.ts";

const env = edgeEnv(Deno.env.toObject());

Deno.serve({ hostname: Deno.env.get("HOST") ?? "0.0.0.0", port: Number(Deno.env.get("PORT") ?? 8000) }, (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  return handleReminderRequest(request, env.CRON_SECRET, () => {
    const config = reminderServerConfig(env);
    return config ? reminderDeps(config, createPush(config)) : null;
  });
});
