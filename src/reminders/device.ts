export type DevicePush = { endpoint: string; unsubscribe(): Promise<boolean> };
export type SubscriptionRows = {
  has(userId: string, endpoint: string): Promise<boolean>;
  remove(userId: string, endpoint: string): Promise<void>;
};

export async function remindersOnHere(userId: string, reminderTime: string | null, push: DevicePush | null, rows: SubscriptionRows): Promise<boolean> {
  if (!push || !reminderTime) return false;
  return rows.has(userId, push.endpoint);
}

export async function forgetThisDevice(userId: string, push: DevicePush | null, rows: SubscriptionRows): Promise<void> {
  if (!push) return;
  try {
    await rows.remove(userId, push.endpoint);
  } catch {
  } finally {
    await push.unsubscribe().catch(() => false);
  }
}
