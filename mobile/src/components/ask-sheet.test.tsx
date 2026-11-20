import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Platform, StyleSheet } from 'react-native';

import { fakeAuth, resetFakeAuth } from '@/account/fake-supabase';
import { SessionProvider } from '@/account/session';

import { AskSheet } from './ask-sheet';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

/* eslint-disable @typescript-eslint/no-require-imports -- the mock factory cannot close over an import */
jest.mock('@/account/supabase', () => require('@/account/fake-supabase'));
/* eslint-enable @typescript-eslint/no-require-imports */

const ASK = 'https://project.test/functions/v1/ask';
const ORIGINAL = process.env.EXPO_PUBLIC_ASSISTANT_URL;
const INVITATION = 'The study assistant is by invitation for now.';
const UPSTREAM = 'The study assistant couldn\u2019t answer just now. Please try again in a moment.';
const REFUSED =
  'The study assistant can\u2019t help with that one. It answers questions about the history, places and people in today\u2019s reading.';
const TRUNCATED = 'This answer reached its length limit, so it ends part way.';
const CUT_OFF = 'The answer was cut off part way. Please try again.';
const RATE = 'You\u2019ve asked 30 questions today. The assistant will be ready again tomorrow.';
const REPORT_LIMIT = 'You\u2019ve sent 10 reports today. You can send more tomorrow.';
const LOADING = 'Looking into today\u2019s reading\u2026';

function questionLine(label: string) {
  const line = screen.getAllByText(label).find((node) => StyleSheet.flatten(node.props.style).fontWeight === '600');
  if (!line) throw new Error(`no question line for ${label}`);
  return line;
}

function isBefore(earlier: ReturnType<typeof screen.getByText>, later: ReturnType<typeof screen.getByText>) {
  const parent = earlier.parent;
  expect(parent).toBe(later.parent);
  const children = parent?.children ?? [];
  expect(children.indexOf(earlier)).toBeGreaterThanOrEqual(0);
  expect(children.indexOf(earlier)).toBeLessThan(children.indexOf(later));
}

type Init = { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal };
type Reply = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  body: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }> } } | null;
};

function json(status: number, body: unknown): Reply {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    body: null,
  };
}

function bytes(parts: string[], pauseAt?: { index: number; gate: Promise<void> }): Reply {
  const encoder = new TextEncoder();
  const chunks = parts.map((part) => encoder.encode(part));
  let index = 0;
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => parts.join(''),
    body: {
      getReader() {
        return {
          async read() {
            if (pauseAt && index === pauseAt.index) await pauseAt.gate;
            if (index >= chunks.length) return { done: true, value: undefined };
            const value = chunks[index];
            index += 1;
            return { done: false, value };
          },
        };
      },
    },
  };
}

function renderSheet(transport: (url: string, init: Init) => Promise<Reply>, onSignIn = jest.fn(), onClose = jest.fn()) {
  return render(
    <SessionProvider>
      <AskSheet dayIndex={0} onClose={onClose} onSignIn={onSignIn} transport={transport} />
    </SessionProvider>,
  );
}

describe('AskSheet', () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});

  beforeEach(() => {
    resetFakeAuth();
    process.env.EXPO_PUBLIC_ASSISTANT_URL = ASK;
    fakeAuth.session = { access_token: 'token', user: { id: 'user-1', email: 'reader@example.com' } };
    announce.mockClear();
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.EXPO_PUBLIC_ASSISTANT_URL;
    else process.env.EXPO_PUBLIC_ASSISTANT_URL = ORIGINAL;
  });

  it('shows the invitation and nothing to ask when the account is not enabled', async () => {
    const calls: Init[] = [];
    await renderSheet(async (_url, init) => {
      calls.push(init);
      return json(200, { configured: true, signInRequired: true, enabled: false });
    });

    const line = await screen.findByText(INVITATION);
    expect(StyleSheet.flatten(line.props.style).color).toBe('#5a5a54');
    expect(screen.queryByRole('button', { name: 'Historical setting' })).toBeNull();
    expect(screen.queryByLabelText('Ask about this reading')).toBeNull();
    expect(calls[0]?.headers.Authorization).toBe('Bearer token');
    expect(calls[0]?.headers.apikey).toBe('anon-test');
    expect(screen.queryByText(/free questions/)).toBeNull();
  });

  it('asks a signed-out reader to sign in', async () => {
    fakeAuth.session = null;
    const onSignIn = jest.fn();
    await renderSheet(async () => json(200, { configured: true, signInRequired: true }), onSignIn);

    expect(await screen.findByText(/to ask the study assistant/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Historical setting' })).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: /Sign in to ask/ }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('says the assistant is not set up when status says so', async () => {
    await renderSheet(async () => json(200, { configured: false, signInRequired: true }));
    expect(await screen.findByText(/isn\u2019t set up on this copy/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Historical setting' })).toBeNull();
  });

  it('does not ask the server when the address is missing', async () => {
    delete process.env.EXPO_PUBLIC_ASSISTANT_URL;
    const calls: string[] = [];
    await renderSheet(async (url) => {
      calls.push(url);
      return json(200, { configured: true, signInRequired: true, enabled: true });
    });
    expect(await screen.findByText(/isn\u2019t set up on this copy/)).toBeOnTheScreen();
    expect(calls).toEqual([]);
  });

  it('sends a quick prompt and her own question with the day', async () => {
    const calls: { url: string; init: Init }[] = [];
    await renderSheet(async (url, init) => {
      calls.push({ url, init });
      if (init.method === 'GET') return json(200, { configured: true, signInRequired: true, enabled: true });
      return bytes([`Noted.${'\u001E'}complete`]);
    });

    const prompt = await screen.findByRole('button', { name: 'Historical setting' });
    expect(StyleSheet.flatten(prompt.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(prompt);
    await screen.findByText('Noted.');

    const question = screen.getByLabelText('Ask about this reading');
    expect(question.props.maxLength).toBe(500);
    await fireEvent.changeText(question, '  Who is Moses?  ');
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Who is Moses?');

    const posts = calls.filter((call) => call.init.method === 'POST');
    expect(posts[0]?.url).toBe(ASK);
    expect(JSON.parse(posts[0]?.init.body ?? '')).toEqual({ dayIndex: 0, type: 'history' });
    expect(posts[0]?.init.headers).toMatchObject({ Authorization: 'Bearer token', apikey: 'anon-test' });
    expect(JSON.parse(posts[1]?.init.body ?? '')).toEqual({ dayIndex: 0, question: 'Who is Moses?' });
    expect(await screen.findByRole('button', { name: 'Where on the map' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Who\u2019s who' })).toBeOnTheScreen();
  });

  it('shows a streamed answer as it arrives and announces it once when it finishes', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await renderSheet(async (_url, init) => {
      if (init.method === 'GET') return json(200, { configured: true, signInRequired: true, enabled: true });
      return bytes(['North', ` of Canaan.${'\u001E'}complete`], { index: 1, gate });
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Where on the map' }));
    const partial = await screen.findByText('North');
    expect(partial.props.accessibilityLiveRegion).toBeUndefined();
    expect(announce).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Report this answer' })).toBeNull();

    release();
    const answer = await screen.findByText('North of Canaan.');
    const style = StyleSheet.flatten(answer.props.style);
    expect(style.fontFamily).toBe('SourceSerif4');
    expect(style.fontSize).toBe(17);
    expect(style.lineHeight).toBe(17 * 1.55);
    expect(answer.props.accessibilityLiveRegion).toBeUndefined();
    await waitFor(() => expect(announce).toHaveBeenCalledTimes(1));
    expect(announce).toHaveBeenCalledWith('North of Canaan.');
    expect(screen.getByRole('button', { name: 'Report this answer' })).toBeOnTheScreen();
  });

  it.each([
    ['refused', REFUSED, false],
    ['truncated', TRUNCATED, true],
    ['error', CUT_OFF, false],
    ['care', 'Please call 988.', false],
  ] as const)('ends a %s answer on that frame', async (end, line, report) => {
    const text = end === 'care' ? 'Please call 988.' : 'Half an answer.';
    await renderSheet(async (_url, init) => {
      if (init.method === 'GET') return json(200, { configured: true, signInRequired: true, enabled: true });
      return bytes([`${text}${'\u001E'}${end}`]);
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Historical setting' }));
    if (end === 'refused') {
      expect(await screen.findByText(line)).toBeOnTheScreen();
      expect(screen.queryByText(text)).toBeNull();
    } else if (end === 'care') {
      const care = await screen.findByText(text);
      expect(StyleSheet.flatten(care.props.style).color).not.toBe('#c4342b');
      expect(StyleSheet.flatten(care.props.style).fontFamily).toBe('SourceSerif4');
    } else {
      expect(await screen.findByText(text)).toBeOnTheScreen();
      expect(screen.getByText(line)).toBeOnTheScreen();
    }
    expect(screen.queryByRole('button', { name: 'Report this answer' }) === null).toBe(!report);
  });

  it.each([
    [401, { code: 'unauthorized', error: 'Please sign in.' }, 'Please sign in.'],
    [403, { code: 'not_enabled', error: INVITATION }, INVITATION],
    [429, { code: 'rate_limited', error: RATE }, RATE],
    [400, { code: 'invalid', error: 'That question couldn\u2019t be read. Questions can be up to 500 characters.' }, /couldn\u2019t be read/],
    [502, { code: 'upstream', error: UPSTREAM }, UPSTREAM],
    [503, { code: 'not_configured', error: 'The study assistant isn\u2019t set up on this copy of the app.' }, /isn\u2019t set up/],
  ] as const)('maps status %s to its line', async (status, body, line) => {
    await renderSheet(async (_url, init) => {
      if (init.method === 'GET') return json(200, { configured: true, signInRequired: true, enabled: true });
      return json(status, body);
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Historical setting' }));
    expect(await screen.findByText(line)).toBeOnTheScreen();
  });

  it('keeps the prompts when a 503 is an upstream failure', async () => {
    await renderSheet(async (_url, init) => {
      if (init.method === 'GET') return json(200, { configured: true, signInRequired: true, enabled: true });
      return json(503, { code: 'upstream', error: UPSTREAM });
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Historical setting' }));
    expect(await screen.findByText(UPSTREAM)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Historical setting' })).toBeOnTheScreen();
    expect(screen.queryByText(/isn\u2019t set up/)).toBeNull();
  });

  it('asks a signed-out reader to sign in when the ask is unauthorized', async () => {
    fakeAuth.session = null;
    await renderSheet(async (_url, init) => {
      if (init.method === 'GET') return json(200, { configured: true, signInRequired: false, enabled: true });
      return json(401, { code: 'unauthorized', error: 'Please sign in.' });
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Historical setting' }));
    expect(await screen.findByRole('link', { name: /Sign in to ask/ })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Historical setting' })).toBeNull();
  });

  it('tries the status check again after it fails', async () => {
    let down = true;
    await renderSheet(async () => {
      if (down) throw new Error('offline');
      return json(200, { configured: true, signInRequired: true, enabled: true });
    });
    expect(await screen.findByText(UPSTREAM)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Historical setting' })).toBeNull();
    down = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Historical setting' })).toBeOnTheScreen();
    expect(screen.queryByText(UPSTREAM)).toBeNull();
  });

  it('says the assistant could not answer when the network fails', async () => {
    await renderSheet(async (_url, init) => {
      if (init.method === 'GET') return json(200, { configured: true, signInRequired: true, enabled: true });
      throw new Error('offline');
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Historical setting' }));
    expect(await screen.findByText(UPSTREAM)).toBeOnTheScreen();
  });

  it('aborts an answer when the sheet closes', async () => {
    let signal: AbortSignal | undefined;
    const view = await renderSheet(async (_url, init) => {
      if (init.method === 'GET') return json(200, { configured: true, signInRequired: true, enabled: true });
      signal = init.signal;
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Historical setting' }));
    await waitFor(() => expect(signal).toBeDefined());
    await view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('reports an answer once and shows the result', async () => {
    const calls: { url: string; init: Init }[] = [];
    let release: (reply: Reply) => void = () => {};
    await renderSheet(async (url, init) => {
      calls.push({ url, init });
      if (init.method === 'GET') return json(200, { configured: true, signInRequired: true, enabled: true });
      if (url.endsWith('/report')) return new Promise<Reply>((resolve) => { release = resolve; });
      return bytes([`Moses speaks.${'\u001E'}complete`]);
    });

    await fireEvent.press(await screen.findByRole('button', { name: 'Historical setting' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Report this answer' }));
    const note = screen.getByLabelText('Add a note, if you want');
    expect(note.props.maxLength).toBe(300);
    await fireEvent.changeText(note, '  Too vague  ');
    await fireEvent.press(screen.getByText('Send'));
    await fireEvent.press(screen.getByText('Send'));

    await waitFor(() => expect(calls.filter((call) => call.url.endsWith('/report'))).toHaveLength(1));
    release(json(200, { ok: true }));
    expect(await screen.findByText('Thanks. The answer was reported.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Report this answer' })).toBeNull();
    expect(calls.filter((call) => call.url.endsWith('/report'))).toHaveLength(1);
    expect(JSON.parse(calls.find((call) => call.url.endsWith('/report'))?.init.body ?? '')).toEqual({
      dayIndex: 0,
      kind: 'history',
      answer: 'Moses speaks.',
      note: 'Too vague',
    });
  });

  it('sends her question with a report, and shows the server message when she is limited', async () => {
    const calls: { url: string; init: Init }[] = [];
    await renderSheet(async (url, init) => {
      calls.push({ url, init });
      if (init.method === 'GET') return json(200, { configured: true, signInRequired: true, enabled: true });
      if (url.endsWith('/report')) return json(429, { code: 'rate_limited', error: REPORT_LIMIT });
      return bytes([`Because she asked.${'\u001E'}complete`]);
    });
    await screen.findByLabelText('Ask about this reading');
    await fireEvent.changeText(screen.getByLabelText('Ask about this reading'), 'Why these rules?');
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Because she asked.');
    await fireEvent.press(screen.getByRole('button', { name: 'Report this answer' }));
    await fireEvent.press(screen.getByText('Send'));
    expect(await screen.findByText(REPORT_LIMIT)).toBeOnTheScreen();
    const report = calls.find((call) => call.url.endsWith('/report'));
    expect(JSON.parse(report?.init.body ?? '')).toEqual({
      dayIndex: 0,
      kind: 'question',
      question: 'Why these rules?',
      answer: 'Because she asked.',
    });
  });

  it('shows a quick prompt’s label as the question line before the answer', async () => {
    await renderSheet(async (_url, init) => {
      if (init.method === 'GET') return json(200, { configured: true, signInRequired: true, enabled: true });
      return bytes([`Noted.${'\u001E'}complete`]);
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Historical setting' }));
    const answer = await screen.findByText('Noted.');
    isBefore(questionLine('Historical setting'), answer);
  });

  it('keeps a typed question above the upstream line after a 502', async () => {
    await renderSheet(async (_url, init) => {
      if (init.method === 'GET') return json(200, { configured: true, signInRequired: true, enabled: true });
      return json(502, { code: 'upstream', error: UPSTREAM });
    });
    await screen.findByLabelText('Ask about this reading');
    await fireEvent.changeText(screen.getByLabelText('Ask about this reading'), 'Who wrote this?');
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    const question = await screen.findByText('Who wrote this?');
    isBefore(question, screen.getByText(UPSTREAM));
  });

  it('shows a loading line while the answer has not arrived', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await renderSheet(async (_url, init) => {
      if (init.method === 'GET') return json(200, { configured: true, signInRequired: true, enabled: true });
      return bytes([`Noted.${'\u001E'}complete`], { index: 0, gate });
    });
    await fireEvent.press(await screen.findByRole('button', { name: 'Historical setting' }));
    expect(await screen.findByText(LOADING)).toBeOnTheScreen();
    release();
    await screen.findByText('Noted.');
    expect(screen.queryByText(LOADING)).toBeNull();
  });

  it('clears the question field once the ask starts', async () => {
    await renderSheet(async (_url, init) => {
      if (init.method === 'GET') return json(200, { configured: true, signInRequired: true, enabled: true });
      return bytes([`Because she asked.${'\u001E'}complete`]);
    });
    const field = await screen.findByLabelText('Ask about this reading');
    await fireEvent.changeText(field, 'Why these rules?');
    await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Because she asked.');
    expect(screen.getByLabelText('Ask about this reading').props.value).toBe('');
  });

  it('uses Done on iOS and a close control on Android', async () => {
    const onClose = jest.fn();
    const transport = async () => json(200, { configured: false, signInRequired: true });
    const view = await renderSheet(transport, jest.fn(), onClose);
    expect(await screen.findByText(/isn\u2019t set up on this copy/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await view.unmount();

    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    try {
      onClose.mockClear();
      await renderSheet(transport, jest.fn(), onClose);
      expect(await screen.findByText(/isn\u2019t set up on this copy/)).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    } finally {
      Object.defineProperty(Platform, 'OS', { get: () => original });
    }
  });
});
