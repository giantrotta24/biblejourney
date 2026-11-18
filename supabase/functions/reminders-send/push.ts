// @ts-types="npm:@types/web-push@3.6.4"
import * as webpush from "web-push";
import { isPushEndpoint } from "../_shared/reminders/endpoints.ts";
import { PUSH_TIMEOUT_MS, type ServerConfig } from "../_shared/reminders/server.ts";
import type { ReminderDeps } from "../_shared/reminders/send.ts";

export function createPush(config: ServerConfig, endpointCheck = isPushEndpoint): ReminderDeps["push"] {
  return async (subscription, message) => {
    if (!endpointCheck(subscription.endpoint)) throw new Error("Not a known push service");
    const details = webpush.generateRequestDetails(subscription, JSON.stringify(message), {
      vapidDetails: { subject: config.vapidSubject, publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey },
      TTL: 12 * 60 * 60, urgency: "normal",
    });
    const response = await fetch(details.endpoint, {
      method: details.method,
      headers: details.headers,
      body: details.body ? new Uint8Array(details.body) : null,
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    });
    await response.body?.cancel();
    if (!response.ok) {
      throw Object.assign(new Error(`Push service returned ${response.status}`), { statusCode: response.status });
    }
  };
}
