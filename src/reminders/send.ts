import { createHash, timingSafeEqual } from "node:crypto";
import { currentDay } from "@/content/plan";
import { dueReminderDate } from "./due";

export type StoredSubscription = { endpoint: string; keys: { p256dh: string; auth: string } };
export type ReminderCandidate = { userId: string; timezone: string; reminderTime: string | null; lastRemindedOn: string | null };
export type PushMessage = { title: string; body: string; url: string };

export type ReminderStore = {
  candidates(): Promise<ReminderCandidate[]>;
  claim(userId: string, date: string): Promise<boolean>;
  subscriptions(userId: string): Promise<StoredSubscription[]>;
  completedDays(userId: string): Promise<number[]>;
  removeSubscription(userId: string, endpoint: string): Promise<void>;
};

export type ReminderDeps = {
  store: ReminderStore;
  push(subscription: StoredSubscription, message: PushMessage): Promise<void>;
  now(): Date;
};

export type ReminderRun = { due: number; sent: number; removed: number };

const GONE = new Set([404, 410]);

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function authorized(request: Request, cronSecret: string | undefined): boolean {
  if (!cronSecret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  return timingSafeEqual(digest(token), digest(cronSecret));
}

function statusOf(error: unknown): number | null {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === "number" ? status : null;
}

export async function sendDueReminders({ store, push, now }: ReminderDeps): Promise<ReminderRun> {
  const run: ReminderRun = { due: 0, sent: 0, removed: 0 };
  const instant = now();

  for (const candidate of await store.candidates()) {
    const date = dueReminderDate(candidate, instant);
    if (!date) continue;
    const subscriptions = await store.subscriptions(candidate.userId);
    if (subscriptions.length === 0) continue;
    if (!(await store.claim(candidate.userId, date))) continue;
    run.due += 1;

    const day = currentDay(new Set(await store.completedDays(candidate.userId)));
    if (!day) continue;
    const message: PushMessage = { title: "Today’s reading is ready", body: day.reading, url: "/" };

    for (const subscription of subscriptions) {
      try {
        await push(subscription, message);
        run.sent += 1;
      } catch (error) {
        const status = statusOf(error);
        if (status !== null && GONE.has(status)) {
          await store.removeSubscription(candidate.userId, subscription.endpoint);
          run.removed += 1;
        } else {
          console.warn("A reminder could not be delivered", status ?? error);
        }
      }
    }
  }

  return run;
}

export async function handleReminderRequest(
  request: Request,
  cronSecret: string | undefined,
  deps: () => ReminderDeps | null | Promise<ReminderDeps | null>,
): Promise<Response> {
  if (!authorized(request, cronSecret)) return Response.json({ status: "unauthorized" }, { status: 401 });
  const ready = await deps();
  if (!ready) return Response.json({ status: "not-configured" }, { status: 503 });
  const run = await sendDueReminders(ready);
  return Response.json({ status: "ok", ...run });
}
