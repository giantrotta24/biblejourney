import { utcDay } from "./limiter";

export const REPORT_KINDS = ["question", "history", "map", "people"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const REPORT_ANSWER_MAX = 4000;
export const REPORT_NOTE_MAX = 300;
export const DAILY_REPORT_LIMIT = 10;

export type StoredReport = {
  userId: string;
  dayIndex: number;
  kind: ReportKind;
  question: string | null;
  answer: string;
  note: string | null;
  model: string;
  promptVersion: string;
};

export interface ReportLog {
  count(userId: string, now: Date): Promise<number>;
  write(report: StoredReport, now: Date): Promise<void>;
}

export type SavedReport = StoredReport & { day: string };

export function memoryReports(): ReportLog & { rows: SavedReport[] } {
  const rows: SavedReport[] = [];
  return {
    rows,
    async count(userId, now) {
      const day = utcDay(now);
      return rows.filter((row) => row.userId === userId && row.day === day).length;
    },
    async write(report, now) {
      rows.push({ ...report, day: utcDay(now) });
    },
  };
}

export function utcDayBounds(now: Date): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}
