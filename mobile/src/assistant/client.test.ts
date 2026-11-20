import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fetch as expoFetch } from 'expo/fetch';

import { endFrame } from '../../../supabase/functions/_shared/assistant/wire';

import {
  defaultTransport,
  loadStatus,
  requestAnswer,
  submitReport,
  textChunks,
  type AssistantResponse,
  type AssistantTransport,
} from './client';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const URL = 'https://project.test/functions/v1/ask';
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer token',
  apikey: 'anon-key',
};

function response(partial: Partial<AssistantResponse> & Pick<AssistantResponse, 'ok' | 'status'>): AssistantResponse {
  return {
    json: async () => ({}),
    text: async () => '',
    body: null,
    ...partial,
  };
}

function streamed(parts: string[]): AssistantResponse {
  const encoder = new TextEncoder();
  const chunks = parts.map((part) => encoder.encode(part));
  let index = 0;
  return response({
    ok: true,
    status: 200,
    text: async () => {
      throw new Error('whole body');
    },
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) return { done: true, value: undefined };
            const value = chunks[index];
            index += 1;
            return { done: false, value };
          },
        };
      },
    },
  });
}

describe('ask client', () => {
  const transport = jest.fn<AssistantTransport>();

  beforeEach(() => {
    transport.mockReset();
  });

  it('sends a quick prompt and a question with the session and the anon key', async () => {
    transport.mockResolvedValue(streamed([`An answer.${endFrame('complete')}`]));
    const signal = new AbortController().signal;

    await requestAnswer({
      transport,
      url: URL,
      token: 'token',
      anonKey: 'anon-key',
      payload: { dayIndex: 68, type: 'map' },
      signal,
      onText: () => {},
    });
    await requestAnswer({
      transport,
      url: URL,
      token: 'token',
      anonKey: 'anon-key',
      payload: { dayIndex: 68, question: 'Who is Moses?' },
      signal,
      onText: () => {},
    });

    expect(transport).toHaveBeenNthCalledWith(1, URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ dayIndex: 68, type: 'map' }),
      signal,
    });
    expect(transport).toHaveBeenNthCalledWith(2, URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ dayIndex: 68, question: 'Who is Moses?' }),
      signal,
    });
  });

  it('reads a streamed answer as it arrives and stops on each end frame', async () => {
    const ends = ['complete', 'refused', 'truncated', 'error', 'care'] as const;
    for (const end of ends) {
      transport.mockResolvedValueOnce(streamed(['Moses ', `speaks.${endFrame(end)}`]));
      const seen: string[] = [];
      const outcome = await requestAnswer({
        transport,
        url: URL,
        token: 'token',
        anonKey: 'anon-key',
        payload: { dayIndex: 1, type: 'history' },
        signal: new AbortController().signal,
        onText: (text) => seen.push(text),
      });
      expect(seen).toEqual(['Moses ', 'Moses speaks.']);
      expect(outcome).toEqual({ kind: 'answer', text: 'Moses speaks.', end });
    }
  });

  it('waits for an end token that arrives split across chunks', async () => {
    transport.mockResolvedValue(streamed(['Answer', '\u001Ecomp', 'lete']));
    const seen: string[] = [];
    const outcome = await requestAnswer({
      transport,
      url: URL,
      token: null,
      anonKey: null,
      payload: { dayIndex: 1, type: 'people' },
      signal: new AbortController().signal,
      onText: (text) => seen.push(text),
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((text) => text === 'Answer')).toBe(true);
    expect(outcome).toEqual({ kind: 'answer', text: 'Answer', end: 'complete' });
  });

  it('reads the whole body when the response cannot stream', async () => {
    transport.mockResolvedValue(
      response({
        ok: true,
        status: 200,
        text: async () => `Cached.${endFrame('complete')}`,
        body: null,
      }),
    );
    const seen: string[] = [];
    const outcome = await requestAnswer({
      transport,
      url: URL,
      token: 'token',
      anonKey: 'anon-key',
      payload: { dayIndex: 1, type: 'history' },
      signal: new AbortController().signal,
      onText: (text) => seen.push(text),
    });
    expect(seen).toEqual(['Cached.']);
    expect(outcome).toEqual({ kind: 'answer', text: 'Cached.', end: 'complete' });
  });

  it('returns the server error code instead of an answer', async () => {
    transport.mockResolvedValue(
      response({
        ok: false,
        status: 429,
        json: async () => ({
          code: 'rate_limited',
          error: 'You’ve asked 30 questions today. The assistant will be ready again tomorrow.',
        }),
      }),
    );
    const outcome = await requestAnswer({
      transport,
      url: URL,
      token: 'token',
      anonKey: 'anon-key',
      payload: { dayIndex: 1, question: 'Why?' },
      signal: new AbortController().signal,
      onText: () => {},
    });
    expect(outcome).toEqual({
      kind: 'failure',
      status: 429,
      code: 'rate_limited',
      message: 'You’ve asked 30 questions today. The assistant will be ready again tomorrow.',
    });
  });

  it('stops when the sheet aborts the request', async () => {
    const controller = new AbortController();
    transport.mockImplementation(async (_url, init) => {
      controller.abort();
      if (init.signal?.aborted) throw new Error('aborted');
      return streamed([endFrame('complete')]);
    });
    const outcome = await requestAnswer({
      transport,
      url: URL,
      token: 'token',
      anonKey: 'anon-key',
      payload: { dayIndex: 1, type: 'history' },
      signal: controller.signal,
      onText: () => {},
    });
    expect(outcome).toEqual({ kind: 'aborted' });
  });

  it('checks status with the bearer when she is signed in', async () => {
    transport.mockResolvedValue(
      response({
        ok: true,
        status: 200,
        json: async () => ({ configured: true, signInRequired: true, enabled: false }),
      }),
    );
    const status = await loadStatus({
      transport,
      url: URL,
      token: 'token',
      anonKey: 'anon-key',
    });
    expect(status).toEqual({ configured: true, signInRequired: true, enabled: false });
    expect(transport).toHaveBeenCalledWith(URL, {
      method: 'GET',
      headers: { Authorization: 'Bearer token', apikey: 'anon-key' },
      signal: undefined,
    });
  });

  it('posts a report once with the question or the quick prompt', async () => {
    transport.mockResolvedValue(response({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    const signal = new AbortController().signal;
    await submitReport({
      transport,
      url: `${URL}/report`,
      token: 'token',
      anonKey: 'anon-key',
      signal,
      payload: {
        dayIndex: 68,
        kind: 'question',
        question: 'Who is Moses?',
        answer: 'Moses speaks.',
        note: 'Too vague',
      },
    });
    await submitReport({
      transport,
      url: `${URL}/report`,
      token: 'token',
      anonKey: 'anon-key',
      signal,
      payload: { dayIndex: 68, kind: 'history', answer: 'Moses speaks.' },
    });
    expect(transport).toHaveBeenNthCalledWith(1, `${URL}/report`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        dayIndex: 68,
        kind: 'question',
        question: 'Who is Moses?',
        answer: 'Moses speaks.',
        note: 'Too vague',
      }),
      signal,
    });
    expect(transport).toHaveBeenNthCalledWith(2, `${URL}/report`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ dayIndex: 68, kind: 'history', answer: 'Moses speaks.' }),
      signal,
    });
  });

  it('returns the report limit message', async () => {
    transport.mockResolvedValue(
      response({
        ok: false,
        status: 429,
        json: async () => ({ error: 'You’ve sent 10 reports today. You can send more tomorrow.', code: 'rate_limited' }),
      }),
    );
    const outcome = await submitReport({
      transport,
      url: `${URL}/report`,
      token: 'token',
      anonKey: 'anon-key',
      signal: new AbortController().signal,
      payload: { dayIndex: 1, kind: 'map', answer: 'North.' },
    });
    expect(outcome).toEqual({
      kind: 'failure',
      status: 429,
      message: 'You’ve sent 10 reports today. You can send more tomorrow.',
    });
  });
});

describe('textChunks', () => {
  it('yields one chunk from text() when there is no reader', async () => {
    const chunks: string[] = [];
    for await (const chunk of textChunks(response({ ok: true, status: 200, text: async () => 'Whole' }))) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['Whole']);
  });
});

it('calls expo/fetch so the answer can stream', async () => {
  const body = {
    getReader() {
      return { async read() { return { done: true, value: undefined }; } };
    },
  };
  jest.mocked(expoFetch).mockResolvedValue({
    ok: true,
    status: 200,
    body,
    json: async () => ({}),
    text: async () => '',
  } as never);
  const signal = new AbortController().signal;
  const result = await defaultTransport(URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer token' },
    body: '{}',
    signal,
  });
  expect(expoFetch).toHaveBeenCalledWith(URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer token' },
    body: '{}',
    signal,
  });
  expect(result.body).toBe(body);
});
