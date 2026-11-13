import type { QuickPromptType } from "./types";

export interface AnswerCache {
  get(dayIndex: number, type: QuickPromptType): Promise<string | null>;
  set(dayIndex: number, type: QuickPromptType, answer: string): Promise<void>;
}

export function memoryCache(): AnswerCache {
  const answers = new Map<string, string>();
  return {
    async get(dayIndex, type) {
      return answers.get(`${dayIndex}|${type}`) ?? null;
    },
    async set(dayIndex, type, answer) {
      answers.set(`${dayIndex}|${type}`, answer);
    },
  };
}
