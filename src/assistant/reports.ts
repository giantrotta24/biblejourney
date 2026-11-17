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
  submit(report: StoredReport, now: Date): Promise<boolean>;
}

export type SavedReport = StoredReport & { day: string };

export function memoryReports(): ReportLog & { rows: SavedReport[] } {
  const rows: SavedReport[] = [];
  return {
    rows,
    async submit(report, now) {
      const day = utcDay(now);
      const used = rows.filter((row) => row.userId === report.userId && row.day === day).length;
      if (used >= DAILY_REPORT_LIMIT) return false;
      rows.push({ ...report, day });
      return true;
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
