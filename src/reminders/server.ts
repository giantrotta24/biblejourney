import { isPushEndpoint } from "@server/reminders/endpoints";
import { reminderDeps as sharedReminderDeps, reminderServerConfig, PUSH_TIMEOUT_MS, type ServerConfig } from "@server/reminders/server";
export { reminderServerConfig };

export async function reminderDeps(config: ServerConfig) {
  const webpush = await import("web-push");
  return sharedReminderDeps(config, async (subscription, message) => {
    if (!isPushEndpoint(subscription.endpoint)) throw new Error("Not a known push service");
    await webpush.sendNotification(subscription, JSON.stringify(message), {
      vapidDetails: { subject: config.vapidSubject, publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey },
      TTL: 12 * 60 * 60, urgency: "normal", timeout: PUSH_TIMEOUT_MS,
    });
  });
}
