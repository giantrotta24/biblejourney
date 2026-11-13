import { z } from "zod";
import { DAY_COUNT } from "@/content/plan";

export const QUESTION_MAX_LENGTH = 500;
export const DAILY_QUESTION_LIMIT = 30;

export const QUICK_PROMPT_TYPES = ["history", "map", "people"] as const;
export type QuickPromptType = (typeof QUICK_PROMPT_TYPES)[number];

const dayIndex = z.number().int().min(0).max(DAY_COUNT - 1);

export const askRequestSchema = z.union([
  z.strictObject({ dayIndex, type: z.enum(QUICK_PROMPT_TYPES) }),
  z.strictObject({
    dayIndex,
    question: z
      .string()
      .max(QUESTION_MAX_LENGTH)
      .refine((value) => value.trim().length > 0, "Ask a question first"),
  }),
]);

export type AskRequest = z.infer<typeof askRequestSchema>;

export type AskErrorCode = "not_configured" | "unauthorized" | "rate_limited" | "invalid" | "upstream";
