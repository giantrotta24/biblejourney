import { handleReminderRequest } from "@server/reminders/send";
import { reminderDeps, reminderServerConfig } from "@/reminders/server";

export async function POST(request: Request) {
  return handleReminderRequest(request, process.env.CRON_SECRET, async () => {
    const config = reminderServerConfig(process.env);
    return config ? reminderDeps(config) : null;
  });
}
