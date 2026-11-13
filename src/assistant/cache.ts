import type { QuickPromptType } from "./types";

export type AnswerKey = { dayIndex: number; type: QuickPromptType; model: string; promptVersion: string };

export interface AnswerCache {
  get(key: AnswerKey): Promise<string | null>;
  set(key: AnswerKey, answer: string): Promise<void>;
}

const keyOf = (key: AnswerKey) => JSON.stringify([key.dayIndex, key.type, key.model, key.promptVersion]);

export function memoryCache(): AnswerCache {
  const answers = new Map<string, string>();
  return {
    async get(key) {
      return answers.get(keyOf(key)) ?? null;
    },
    async set(key, answer) {
      answers.set(keyOf(key), answer);
    },
  };
}
