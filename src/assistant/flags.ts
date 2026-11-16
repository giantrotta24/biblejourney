export const FLAG_CATEGORIES = ["off_topic", "inappropriate", "manipulation", "crisis", "withheld"] as const;
export type FlagCategory = (typeof FLAG_CATEGORIES)[number];

export type FlagRow = { userId: string | null; dayIndex: number; category: FlagCategory };

export interface FlagLog {
  write(flag: FlagRow): Promise<void>;
}

export function memoryFlags(): FlagLog & { rows: FlagRow[] } {
  const rows: FlagRow[] = [];
  return {
    rows,
    async write(flag) {
      rows.push({ userId: flag.userId, dayIndex: flag.dayIndex, category: flag.category });
    },
  };
}
