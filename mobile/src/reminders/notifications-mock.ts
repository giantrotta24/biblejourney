type NotificationContent = { title?: string | null; body?: string | null; data?: Record<string, unknown> };
type NotificationTrigger = { type?: string; date?: Date | number; channelId?: string };
type ScheduledNotification = { identifier: string; content: NotificationContent; trigger: NotificationTrigger };
type NotificationResponse = { actionIdentifier: string; notification?: unknown };
type Permission = { granted: boolean; canAskAgain: boolean; status: string; expires: 'never' };

const scheduled = new Map<string, ScheduledNotification>();
const channels = new Map<string, { id: string; name: string | null; importance: number }>();
const listeners = new Set<(response: NotificationResponse) => void>();

let permission: Permission = { granted: true, canAskAgain: true, status: 'granted', expires: 'never' };
let requests = 0;
let cancels = 0;
let last: NotificationResponse | null = null;

export function resetNotificationsMock() {
  scheduled.clear();
  channels.clear();
  listeners.clear();
  permission = { granted: true, canAskAgain: true, status: 'granted', expires: 'never' };
  requests = 0;
  cancels = 0;
  last = null;
}

export function scheduledNotifications(): ScheduledNotification[] {
  return [...scheduled.values()];
}

export function notificationChannels(): { id: string; name: string | null; importance: number }[] {
  return [...channels.values()];
}

export function setNotificationPermission(next: Permission) {
  permission = next;
}

export function permissionRequestCount(): number {
  return requests;
}

export function cancelCount(): number {
  return cancels;
}

export function setLastNotificationResponse(response: NotificationResponse | null) {
  last = response;
}

export function emitNotificationResponse(response: NotificationResponse) {
  last = response;
  for (const listener of listeners) listener(response);
}

export function setNotificationHandler(_handler: unknown) {}

export async function getPermissionsAsync(): Promise<Permission> {
  return permission;
}

export async function requestPermissionsAsync(_request?: unknown): Promise<Permission> {
  requests += 1;
  return permission;
}

export async function setNotificationChannelAsync(
  id: string,
  channel: { name: string | null; importance: number },
): Promise<{ id: string; name: string | null; importance: number }> {
  const stored = { id, name: channel.name, importance: channel.importance };
  channels.set(id, stored);
  return stored;
}

export async function getAllScheduledNotificationsAsync(): Promise<ScheduledNotification[]> {
  return scheduledNotifications();
}

export async function cancelScheduledNotificationAsync(identifier: string): Promise<void> {
  cancels += 1;
  scheduled.delete(identifier);
}

export async function cancelAllScheduledNotificationsAsync(): Promise<void> {
  cancels += 1;
  scheduled.clear();
}

export async function scheduleNotificationAsync(request: {
  identifier?: string;
  content: NotificationContent;
  trigger: NotificationTrigger | null;
}): Promise<string> {
  const identifier = request.identifier ?? `generated-${scheduled.size}`;
  scheduled.set(identifier, {
    identifier,
    content: request.content,
    trigger: request.trigger ?? {},
  });
  return identifier;
}

export function addNotificationResponseReceivedListener(listener: (response: NotificationResponse) => void) {
  listeners.add(listener);
  return { remove: () => listeners.delete(listener) };
}

export function getLastNotificationResponse(): NotificationResponse | null {
  return last;
}

export async function getLastNotificationResponseAsync(): Promise<NotificationResponse | null> {
  return last;
}

export function clearLastNotificationResponse() {
  last = null;
}

export async function clearLastNotificationResponseAsync(): Promise<void> {
  last = null;
}

export const AndroidImportance = {
  UNKNOWN: 0,
  UNSPECIFIED: 1,
  NONE: 2,
  MIN: 3,
  LOW: 4,
  DEFAULT: 5,
  HIGH: 6,
  MAX: 7,
} as const;

export const SchedulableTriggerInputTypes = {
  CALENDAR: 'calendar',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
} as const;

export const DEFAULT_ACTION_IDENTIFIER = 'expo.modules.notifications.actions.DEFAULT';
