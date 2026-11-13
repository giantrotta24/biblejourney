import { handleReminderRequest } from "@/reminders/send";
import { reminderDeps, reminderServerConfig } from "@/reminders/server";

export async function POST(request: Request) {
  return handleReminderRequest(request, process.env.CRON_SECRET, async () => {
    const config = reminderServerConfig();
    return config ? reminderDeps(config) : null;
  });
}
