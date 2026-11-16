import { z } from "zod";
import { DAY_COUNT } from "@/content/plan";
import { utcDay } from "./limiter";
import { DAILY_REPORT_LIMIT, QUESTION_MAX_LENGTH, REPORT_ANSWER_MAX, REPORT_NOTE_MAX } from "./limits";

export { DAILY_REPORT_LIMIT, REPORT_ANSWER_MAX, REPORT_NOTE_MAX };

export const REPORT_KINDS = ["question", "history", "map", "people"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

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

const dayIndex = z.number().int().min(0).max(DAY_COUNT - 1);
const answer = z.string().max(REPORT_ANSWER_MAX).refine((value) => value.trim().length > 0, "Write the answer");
const note = z.string().max(REPORT_NOTE_MAX).optional();

export const reportRequestSchema = z.union([
  z.strictObject({
    dayIndex,
    kind: z.literal("question"),
    question: z.string().max(QUESTION_MAX_LENGTH).refine((value) => value.trim().length > 0, "Write the question"),
    answer,
    note,
  }),
  z.strictObject({
    dayIndex,
    kind: z.enum(["history", "map", "people"]),
    answer,
    note,
  }),
]);

export type ReportRequest = z.infer<typeof reportRequestSchema>;

export function utcDayBounds(now: Date): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}
