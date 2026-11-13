export type SyncAction = "start" | "stop" | "none";

export function syncAction(event: string, sessionUserId: string | null, syncingUserId: string | null): SyncAction {
  if (sessionUserId) return sessionUserId === syncingUserId ? "none" : "start";
  return syncingUserId !== null || event === "SIGNED_OUT" ? "stop" : "none";
}
