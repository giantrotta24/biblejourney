import type { Progress } from "@/content/plan";

export type DayRow = { day_index: number; completed_at: string };
export type VerseRow = { week: number; learned_at: string };
export type ProgressRows = { days: DayRow[]; verses: VerseRow[] };

export type ProgressPersistence = {
  load(): Promise<ProgressRows>;
  putDays(rows: readonly DayRow[]): Promise<void>;
  deleteDay(dayIndex: number): Promise<void>;
  putVerses(rows: readonly VerseRow[]): Promise<void>;
  deleteVerse(week: number): Promise<void>;
};

export type ProgressSnapshot = Progress & { ready: boolean };
