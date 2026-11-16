import { QUESTION_MAX_LENGTH } from "./limits";

const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁯﻿]/g;
const QUESTION_DELIMITER = /<\s*\/?\s*question\s*>/gi;
const ANSWER_DELIMITER = /<\s*\/?\s*answer\s*>/gi;

export function sanitizeQuestion(question: string): string {
  return question
    .replace(/[\t\n\r\f\v]/g, " ")
    .replace(CONTROL_CHARACTERS, "")
    .replace(QUESTION_DELIMITER, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, QUESTION_MAX_LENGTH);
}

export function delimitedQuestion(question: string): string {
  return `<question>\n${sanitizeQuestion(question)}\n</question>`;
}

export function delimitedAnswer(answer: string): string {
  const clean = answer.replace(CONTROL_CHARACTERS, (char) => (char === "\n" || char === "\t" ? char : "")).replace(ANSWER_DELIMITER, " ");
  return `<answer>\n${clean}\n</answer>`;
}
