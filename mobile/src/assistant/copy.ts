import type { AskOutcome, QuickPromptType, ReportOutcome } from './client';

const mark = '\u2019';

export const SIGN_IN_LINE = `Sign in to ask the study assistant.`;
export const INVITATION_LINE = 'The study assistant is by invitation for now.';
export const NOT_CONFIGURED_LINE = `The study assistant isn${mark}t set up on this copy of the app.`;
export const UPSTREAM_LINE = `The study assistant couldn${mark}t answer just now. Please try again in a moment.`;
export const REFUSED_LINE = `The study assistant can${mark}t help with that one. It answers questions about the history, places and people in today${mark}s reading.`;
export const TRUNCATED_LINE = 'This answer reached its length limit, so it ends part way.';
export const CUT_OFF_LINE = 'The answer was cut off part way. Please try again.';
export const REPORT_THANKS = 'Thanks. The answer was reported.';

export const QUICK_PROMPTS: { type: QuickPromptType; label: string }[] = [
  { type: 'history', label: 'Historical setting' },
  { type: 'map', label: 'Where on the map' },
  { type: 'people', label: `Who${mark}s who` },
];

export type SheetLine = { kind: 'sign-in' } | { kind: 'invitation' } | { kind: 'not-configured' } | { kind: 'message'; text: string };

export function failureLine(failure: { status: number; code: string | null; message: string | null }): SheetLine {
  if (failure.status === 401 || failure.code === 'unauthorized') return { kind: 'sign-in' };
  if (failure.status === 403 || failure.code === 'not_enabled') return { kind: 'invitation' };
  if (failure.status === 503 || failure.code === 'not_configured') return { kind: 'not-configured' };
  if (failure.message) return { kind: 'message', text: failure.message };
  return { kind: 'message', text: UPSTREAM_LINE };
}

export function reportLine(outcome: Extract<ReportOutcome, { kind: 'failure' }>): string {
  return outcome.message ?? UPSTREAM_LINE;
}

export function answerNotice(outcome: Extract<AskOutcome, { kind: 'answer' }>): { text: string; keep: boolean; report: boolean; announce: boolean } {
  const text = outcome.text;
  const hasText = text.trim().length > 0;
  if (outcome.end === 'complete') {
    return hasText
      ? { text: '', keep: true, report: true, announce: true }
      : { text: UPSTREAM_LINE, keep: false, report: false, announce: false };
  }
  if (outcome.end === 'truncated') {
    return { text: TRUNCATED_LINE, keep: true, report: hasText, announce: hasText };
  }
  if (outcome.end === 'refused') {
    return { text: REFUSED_LINE, keep: false, report: false, announce: false };
  }
  if (outcome.end === 'care') {
    return { text: '', keep: true, report: false, announce: hasText };
  }
  if (hasText) return { text: CUT_OFF_LINE, keep: true, report: false, announce: true };
  return { text: UPSTREAM_LINE, keep: false, report: false, announce: false };
}
