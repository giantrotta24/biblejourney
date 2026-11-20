import { fetch as expoFetch } from 'expo/fetch';

import { END_MARKER, STREAM_ENDS, type StreamEnd } from '../../../supabase/functions/_shared/assistant/wire';

export type { StreamEnd };

export type QuickPromptType = 'history' | 'map' | 'people';

export type AskPayload = { dayIndex: number; type: QuickPromptType } | { dayIndex: number; question: string };

export type ReportPayload =
  | { dayIndex: number; kind: 'question'; question: string; answer: string; note?: string }
  | { dayIndex: number; kind: QuickPromptType; answer: string; note?: string };

export type ChunkReader = {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  releaseLock?(): void;
};

export type AssistantResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
  body: { getReader(): ChunkReader } | null;
};

export type AssistantInit = {
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
};

export type AssistantTransport = (url: string, init: AssistantInit) => Promise<AssistantResponse>;

export type AssistantStatus = {
  configured: boolean;
  signInRequired: boolean;
  enabled?: boolean;
};

export type AskOutcome =
  | { kind: 'answer'; text: string; end: StreamEnd }
  | { kind: 'failure'; status: number; code: string | null; message: string | null }
  | { kind: 'aborted' };

export type ReportOutcome = { kind: 'ok' } | { kind: 'failure'; status: number; message: string | null } | { kind: 'aborted' };

const ENDS: readonly string[] = STREAM_ENDS;

function requestHeaders(token: string | null, anonKey: string | null, json: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (anonKey) headers.apikey = anonKey;
  return headers;
}

/** expo/fetch streams the body. Global fetch in React Native does not, so a missing reader is read whole. */
export const defaultTransport: AssistantTransport = async (url, init) =>
  expoFetch(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
    signal: init.signal,
  });

export async function* textChunks(response: AssistantResponse): AsyncGenerator<string> {
  const getReader = response.body?.getReader;
  if (typeof getReader !== 'function') {
    const whole = await response.text();
    if (whole) yield whole;
    return;
  }

  let reader: ChunkReader;
  try {
    reader = getReader.call(response.body);
  } catch {
    const whole = await response.text();
    if (whole) yield whole;
    return;
  }

  const decoder = new TextDecoder();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) yield chunk;
    }
    const tail = decoder.decode();
    if (tail) yield tail;
  } finally {
    reader.releaseLock?.();
  }
}

function preview(raw: string): { text: string; end: StreamEnd | null } {
  const at = raw.indexOf(END_MARKER);
  if (at === -1) return { text: raw, end: null };
  const token = raw.slice(at + END_MARKER.length);
  if (ENDS.includes(token)) return { text: raw.slice(0, at), end: token as StreamEnd };
  if (ENDS.some((name) => name.startsWith(token))) return { text: raw.slice(0, at), end: null };
  return { text: raw.slice(0, at), end: 'error' };
}

function finish(raw: string): { text: string; end: StreamEnd } {
  const parsed = preview(raw);
  return { text: parsed.text, end: parsed.end ?? 'error' };
}

async function readError(response: AssistantResponse): Promise<{ code: string | null; message: string | null }> {
  try {
    const body = await response.json();
    if (!body || typeof body !== 'object') return { code: null, message: null };
    const record = body as { code?: unknown; error?: unknown };
    return {
      code: typeof record.code === 'string' ? record.code : null,
      message: typeof record.error === 'string' ? record.error : null,
    };
  } catch {
    return { code: null, message: null };
  }
}

export async function loadStatus(input: {
  transport: AssistantTransport;
  url: string;
  token: string | null;
  anonKey: string | null;
  signal?: AbortSignal;
}): Promise<AssistantStatus> {
  const response = await input.transport(input.url, {
    method: 'GET',
    headers: requestHeaders(input.token, input.anonKey, false),
    signal: input.signal,
  });
  if (!response.ok) throw new Error(String(response.status));
  const body = await response.json();
  if (!body || typeof body !== 'object') throw new Error('status');
  const record = body as { configured?: unknown; signInRequired?: unknown; enabled?: unknown };
  if (typeof record.configured !== 'boolean' || typeof record.signInRequired !== 'boolean') throw new Error('status');
  return {
    configured: record.configured,
    signInRequired: record.signInRequired,
    ...(typeof record.enabled === 'boolean' ? { enabled: record.enabled } : {}),
  };
}

export async function requestAnswer(input: {
  transport: AssistantTransport;
  url: string;
  token: string | null;
  anonKey: string | null;
  payload: AskPayload;
  signal: AbortSignal;
  onText: (text: string) => void;
}): Promise<AskOutcome> {
  let response: AssistantResponse;
  try {
    response = await input.transport(input.url, {
      method: 'POST',
      headers: requestHeaders(input.token, input.anonKey, true),
      body: JSON.stringify(input.payload),
      signal: input.signal,
    });
  } catch {
    if (input.signal.aborted) return { kind: 'aborted' };
    return { kind: 'failure', status: 0, code: null, message: null };
  }

  if (!response.ok) {
    const failure = await readError(response);
    return { kind: 'failure', status: response.status, ...failure };
  }

  let raw = '';
  try {
    for await (const chunk of textChunks(response)) {
      if (input.signal.aborted) return { kind: 'aborted' };
      raw += chunk;
      const parsed = preview(raw);
      input.onText(parsed.text);
      if (parsed.end) return { kind: 'answer', text: parsed.text, end: parsed.end };
    }
  } catch {
    if (input.signal.aborted) return { kind: 'aborted' };
    if (!raw) return { kind: 'failure', status: 0, code: null, message: null };
  }

  const done = finish(raw);
  input.onText(done.text);
  return { kind: 'answer', text: done.text, end: done.end };
}

export async function submitReport(input: {
  transport: AssistantTransport;
  url: string;
  token: string | null;
  anonKey: string | null;
  payload: ReportPayload;
  signal: AbortSignal;
}): Promise<ReportOutcome> {
  try {
    const response = await input.transport(input.url, {
      method: 'POST',
      headers: requestHeaders(input.token, input.anonKey, true),
      body: JSON.stringify(input.payload),
      signal: input.signal,
    });
    if (input.signal.aborted) return { kind: 'aborted' };
    if (!response.ok) {
      const failure = await readError(response);
      return { kind: 'failure', status: response.status, message: failure.message };
    }
    return { kind: 'ok' };
  } catch {
    if (input.signal.aborted) return { kind: 'aborted' };
    return { kind: 'failure', status: 0, message: null };
  }
}
