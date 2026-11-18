import { currentDay } from "../content/plan.ts";
import { dueReminderDate } from "./due.ts";
import { isPushEndpoint, MAX_SUBSCRIPTIONS_PER_READER } from "./endpoints.ts";

export type StoredSubscription = { endpoint: string; keys: { p256dh: string; auth: string }; createdAt?: string };
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

export type ReminderRun = { due: number; sent: number; removed: number; failed: number };

const GONE = new Set([404, 410]);

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function authorized(request: Request, cronSecret: string | undefined): Promise<boolean> {
  if (!cronSecret) return false;
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  const [actual, expected] = await Promise.all([digest(token), digest(cronSecret)]);
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

function statusOf(error: unknown): number | null {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === "number" ? status : null;
}

async function usableSubscriptions(store: ReminderStore, userId: string, run: ReminderRun): Promise<StoredSubscription[]> {
  const newestFirst = [...(await store.subscriptions(userId))].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const usable: StoredSubscription[] = [];
  for (const subscription of newestFirst) {
    if (isPushEndpoint(subscription.endpoint) && usable.length < MAX_SUBSCRIPTIONS_PER_READER) {
      usable.push(subscription);
      continue;
    }
    await store.removeSubscription(userId, subscription.endpoint);
    run.removed += 1;
  }
  return usable;
}

async function remind(deps: ReminderDeps, candidate: ReminderCandidate, date: string, run: ReminderRun) {
  const { store, push } = deps;
  const subscriptions = await usableSubscriptions(store, candidate.userId, run);
  if (subscriptions.length === 0) return;
  const day = currentDay(new Set(await store.completedDays(candidate.userId)));
  if (!(await store.claim(candidate.userId, date))) return;
  run.due += 1;
  if (!day) return;
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

export async function sendDueReminders(deps: ReminderDeps): Promise<ReminderRun> {
  const run: ReminderRun = { due: 0, sent: 0, removed: 0, failed: 0 };
  const instant = deps.now();

  for (const candidate of await deps.store.candidates()) {
    const date = dueReminderDate(candidate, instant);
    if (!date) continue;
    try {
      await remind(deps, candidate, date, run);
    } catch (error) {
      run.failed += 1;
      console.warn("Reminders for one reader failed", error);
    }
  }

  return run;
}

export async function handleReminderRequest(
  request: Request,
  cronSecret: string | undefined,
  deps: () => ReminderDeps | null | Promise<ReminderDeps | null>,
): Promise<Response> {
  if (!(await authorized(request, cronSecret))) return Response.json({ status: "unauthorized" }, { status: 401 });
  const ready = await deps();
  if (!ready) return Response.json({ status: "not-configured" }, { status: 503 });
  const run = await sendDueReminders(ready);
  return Response.json({ status: "ok", ...run });
}
