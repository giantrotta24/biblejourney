import type { ProgressStore } from "./store";

export const RESET_WORD = "RESET";

export function resetConfirmed(typed: string): boolean {
  return typed.trim().toUpperCase() === RESET_WORD;
}

export async function resetProgress(store: ProgressStore): Promise<void> {
  await store.load();
  const { days, verses } = store.rows();
  for (const row of days) await store.removeDay(row.day_index);
  for (const row of verses) await store.removeVerse(row.week);
}
