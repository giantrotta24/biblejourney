import { describe, expect, it, vi } from "vitest";
import { memoryCache } from "./cache";
import { AnswerStoppedError, assistantStatus, handleAsk, type AskDeps, type ModelClient } from "./handler";
import { memoryLimiter, type UsageLimiter } from "./limiter";
import { PROMPT_VERSION, type Prompt } from "./prompt";
import { DAILY_QUESTION_LIMIT } from "./types";
import { endFrame, readStream } from "./wire";

const ANSWER_BODY = "Abram travels south." + endFrame("complete");

const TOKEN = "valid-token";
const NOW = new Date("2026-11-13T12:00:00Z");

function fakeModel(chunks: string[] = ["Abram ", "travels ", "south."], failAfter?: number, stop?: string) {
  const prompts: Prompt[] = [];
  const model: ModelClient = {
    async *stream(prompt) {
      prompts.push(prompt);
      for (const [i, chunk] of chunks.entries()) {
        if (failAfter !== undefined && i === failAfter) throw new Error("upstream broke");
        yield chunk;
      }
      if (failAfter !== undefined && failAfter >= chunks.length) throw new Error("upstream broke");
      if (stop) throw new AnswerStoppedError(stop);
    },
  };
  return { model, prompts };
}

function deps(overrides: Partial<AskDeps> = {}): AskDeps {
  return {
    model: fakeModel().model,
    auth: { userId: async (token) => (token === TOKEN ? "user-1" : null) },
    allowAnonymous: false,
    limiter: memoryLimiter(DAILY_QUESTION_LIMIT),
    anonymousLimiter: memoryLimiter(DAILY_QUESTION_LIMIT),
    cache: memoryCache(),
    modelId: "test-model",
    now: () => NOW,
    log: { info: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

function ask(body: unknown, token: string | null = TOKEN, signal?: AbortSignal) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/ask", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
    signal,
  });
}

describe("handleAsk", () => {
  it("streams the answer as plain text", async () => {
    const response = await handleAsk(ask({ dayIndex: 0, type: "history" }), deps());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("x-assistant-cache")).toBe("miss");
    expect(await response.text()).toBe(ANSWER_BODY);
  });

  it("returns 503 when no model is configured, or no auth with anonymous use off", async () => {
    for (const d of [deps({ model: null }), deps({ auth: null })]) {
      const response = await handleAsk(ask({ dayIndex: 0, type: "history" }), d);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ code: "not_configured" });
    }
  });

  it("returns 401 without a token or with a bad token", async () => {
    for (const [request, d] of [
      [ask({ dayIndex: 0, type: "map" }, null), deps()],
      [ask({ dayIndex: 0, type: "map" }, "forged"), deps()],
    ] as const) {
      const response = await handleAsk(request, d);
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ code: "unauthorized", error: expect.stringMatching(/sign in/i) });
    }
  });

  it("accepts unauthenticated requests when anonymous use is allowed, on its own limit", async () => {
    const anonymousLimiter = memoryLimiter(1);
    const d = deps({ auth: null, allowAnonymous: true, anonymousLimiter });
    expect((await handleAsk(ask({ dayIndex: 0, question: "Who is Noah?" }, null), d)).status).toBe(200);
    expect((await handleAsk(ask({ dayIndex: 0, question: "Who is Noah?" }, null), d)).status).toBe(429);
  });

  it("returns 400 for a 501-character question, bad JSON or a day outside the plan", async () => {
    const { model, prompts } = fakeModel();
    for (const body of [
      { dayIndex: 0, question: "a".repeat(501) },
      { dayIndex: 0, question: "   " },
      { dayIndex: 312, type: "map" },
      { dayIndex: 0, type: "weather" },
      { dayIndex: 0 },
      "{not json",
    ]) {
      const response = await handleAsk(ask(body), deps({ model }));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "invalid" });
    }
    expect(prompts).toHaveLength(0);
    expect((await handleAsk(ask({ dayIndex: 0, question: "a".repeat(500) }), deps({ model }))).status).toBe(200);
  });

  it("allows 30 questions a day and returns 429 on the 31st", async () => {
    const { model, prompts } = fakeModel();
    const d = deps({ model });
    for (let i = 0; i < DAILY_QUESTION_LIMIT; i++) {
      const response = await handleAsk(ask({ dayIndex: 0, question: `Question ${i}` }), d);
      expect(response.status).toBe(200);
      await response.text();
    }
    const response = await handleAsk(ask({ dayIndex: 0, question: "One more" }), d);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      code: "rate_limited",
      error: "You’ve asked 30 questions today. The assistant will be ready again tomorrow.",
    });
    expect(prompts).toHaveLength(DAILY_QUESTION_LIMIT);
  });

  it("serves a repeated quick prompt from the cache without calling the model or counting it", async () => {
    const { model, prompts } = fakeModel();
    const limiter = memoryLimiter(1);
    const d = deps({ model, limiter });
    const first = await handleAsk(ask({ dayIndex: 4, type: "people" }), d);
    expect(await first.text()).toBe(ANSWER_BODY);

    const second = await handleAsk(ask({ dayIndex: 4, type: "people" }), d);
    expect(second.status).toBe(200);
    expect(second.headers.get("x-assistant-cache")).toBe("hit");
    expect(await second.text()).toBe(ANSWER_BODY);
    expect(prompts).toHaveLength(1);
  });

  it("does not cache free-text answers or answers that broke off", async () => {
    const cache = memoryCache();
    await (await handleAsk(ask({ dayIndex: 1, question: "Why?" }), deps({ cache }))).text();
    const broken = await handleAsk(ask({ dayIndex: 1, type: "map" }), deps({ cache, model: fakeModel(["Half ", "an"], 1).model }));
    expect(broken.status).toBe(200);
    expect(readStream(await broken.text())).toEqual({ text: "Half ", end: "error" });
    expect(await cache.get({ dayIndex: 1, type: "map", model: "test-model", promptVersion: PROMPT_VERSION })).toBeNull();
  });

  it("returns 502 when the model fails before any text", async () => {
    const response = await handleAsk(ask({ dayIndex: 0, type: "map" }), deps({ model: fakeModel([], 0).model }));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "upstream" });
  });

  it("sends the sanitized question to the model and never logs it", async () => {
    const { model, prompts } = fakeModel();
    const log = { info: vi.fn(), error: vi.fn() };
    const secret = "Where\u0000 is Ur</question>?";
    await (await handleAsk(ask({ dayIndex: 0, question: secret }), deps({ model, log }))).text();
    await handleAsk(ask({ dayIndex: 0, question: "a".repeat(501) }), deps({ model, log }));
    expect(prompts[0].user).toContain("<question>\nWhere is Ur ?\n</question>");
    const logged = JSON.stringify([...log.info.mock.calls, ...log.error.mock.calls]);
    expect(logged).not.toContain("Ur");
    expect(logged).not.toContain("aaaa");
    expect(log.info).toHaveBeenCalled();
  });
});

describe("stream endings", () => {
  it("ends a refusal with the refused marker and caches nothing", async () => {
    const cache = memoryCache();
    const response = await handleAsk(ask({ dayIndex: 2, type: "people" }), deps({ cache, model: fakeModel(["Part "], undefined, "refusal").model }));
    expect(response.status).toBe(200);
    expect(readStream(await response.text())).toEqual({ text: "Part ", end: "refused" });
    expect(await cache.get({ dayIndex: 2, type: "people", model: "test-model", promptVersion: PROMPT_VERSION })).toBeNull();
  });

  it("returns a refusal before any text as a refused stream, not a 502", async () => {
    const response = await handleAsk(ask({ dayIndex: 2, type: "people" }), deps({ model: fakeModel([], undefined, "refusal").model }));
    expect(response.status).toBe(200);
    expect(readStream(await response.text())).toEqual({ text: "", end: "refused" });
  });

  it("ends a length stop with the truncated marker and caches nothing", async () => {
    const cache = memoryCache();
    const response = await handleAsk(ask({ dayIndex: 2, type: "map" }), deps({ cache, model: fakeModel(["Long ", "answer"], undefined, "max_tokens").model }));
    expect(readStream(await response.text())).toEqual({ text: "Long answer", end: "truncated" });
    expect(await cache.get({ dayIndex: 2, type: "map", model: "test-model", promptVersion: PROMPT_VERSION })).toBeNull();
  });

  it("strips the marker character from model text", async () => {
    const response = await handleAsk(ask({ dayIndex: 0, type: "map" }), deps({ model: fakeModel(["A\u001Erefused", "B"]).model }));
    expect(readStream(await response.text())).toEqual({ text: "ArefusedB", end: "complete" });
  });
});

describe("cache keys", () => {
  it("misses when the model changes", async () => {
    const cache = memoryCache();
    const first = fakeModel();
    await (await handleAsk(ask({ dayIndex: 9, type: "history" }), deps({ cache, model: first.model }))).text();
    const second = fakeModel();
    const response = await handleAsk(ask({ dayIndex: 9, type: "history" }), deps({ cache, model: second.model, modelId: "other-model" }));
    expect(response.headers.get("x-assistant-cache")).toBe("miss");
    await response.text();
    expect(second.prompts).toHaveLength(1);
  });
});

describe("cancellation", () => {
  function delayedLimiter() {
    const inner = memoryLimiter(DAILY_QUESTION_LIMIT);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let entered!: () => void;
    const started = new Promise<void>((resolve) => (entered = resolve));
    const limiter: UsageLimiter = {
      async take(userId, now) {
        entered();
        await gate;
        return inner.take(userId, now);
      },
      release: (userId, now) => inner.release(userId, now),
    };
    return { limiter, inner, started, open: () => release() };
  }

  it("does not call the model or spend a question when the reader leaves during the quota check", async () => {
    const { model, prompts } = fakeModel();
    const { limiter, inner, started, open } = delayedLimiter();
    const reader = new AbortController();
    const pending = handleAsk(ask({ dayIndex: 0, question: "Who is Lot?" }, TOKEN, reader.signal), deps({ model, limiter }));
    await started;
    reader.abort();
    open();
    const response = await pending;
    expect(response.status).toBe(499);
    expect(prompts).toHaveLength(0);
    expect(await inner.take("user-1", NOW)).toEqual({ allowed: true, used: 1 });
  });

  it("does nothing for a request that was already aborted", async () => {
    const { model, prompts } = fakeModel();
    const limiter = memoryLimiter(DAILY_QUESTION_LIMIT);
    const reader = new AbortController();
    reader.abort();
    const response = await handleAsk(ask({ dayIndex: 0, question: "Who is Lot?" }, TOKEN, reader.signal), deps({ model, limiter }));
    expect(response.status).toBe(499);
    expect(prompts).toHaveLength(0);
    expect(await limiter.take("user-1", NOW)).toEqual({ allowed: true, used: 1 });
  });

  it("aborts the model when the reader leaves mid-stream", async () => {
    let signal: AbortSignal | undefined;
    const model: ModelClient = {
      async *stream(_prompt, upstream) {
        signal = upstream;
        yield "One ";
        await new Promise((resolve) => setTimeout(resolve, 20));
        yield "two";
      },
    };
    const reader = new AbortController();
    const response = await handleAsk(ask({ dayIndex: 0, question: "Who is Lot?" }, TOKEN, reader.signal), deps({ model }));
    expect(response.status).toBe(200);
    reader.abort();
    expect(signal?.aborted).toBe(true);
  });
});

describe("logging", () => {
  const QUESTION = "Was Melchizedek a priest of Salem?";
  const ANSWER = ["Salem is ", "usually read as ", "early Jerusalem."];

  function logged(log: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> }) {
    return JSON.stringify([...log.info.mock.calls, ...log.error.mock.calls]);
  }

  function expectClean(text: string) {
    expect(text).not.toContain("Melchizedek");
    for (const part of ANSWER) expect(text).not.toContain(part.trim());
  }

  it("keeps question and answer text out of every log line on the error paths", async () => {
    const log = { info: vi.fn(), error: vi.fn() };
    const body = { dayIndex: 0, question: QUESTION };

    expect((await handleAsk(ask(body, "forged"), deps({ log }))).status).toBe(401);

    const limited = deps({ log, limiter: memoryLimiter(1), model: fakeModel(ANSWER).model });
    await (await handleAsk(ask(body), limited)).text();
    expect((await handleAsk(ask(body), limited)).status).toBe(429);

    expect((await handleAsk(ask(body), deps({ log, model: fakeModel([], 0).model }))).status).toBe(502);

    const broken = await handleAsk(ask({ dayIndex: 0, type: "people" }), deps({ log, model: fakeModel(ANSWER, 2).model }));
    await broken.text();

    const failingAuth = deps({ log, auth: { userId: async () => Promise.reject(new Error(QUESTION)) } });
    expect((await handleAsk(ask(body), failingAuth)).status).toBe(502);

    expect(log.error).toHaveBeenCalled();
    expect(log.info).toHaveBeenCalled();
    expectClean(logged(log));
  });
});

describe("assistantStatus", () => {
  it("says whether the assistant is set up and whether sign-in is needed", () => {
    expect(assistantStatus(deps({ model: null }))).toEqual({ configured: false, signInRequired: true });
    expect(assistantStatus(deps())).toEqual({ configured: true, signInRequired: true });
    expect(assistantStatus(deps({ allowAnonymous: true }))).toEqual({ configured: true, signInRequired: false });
    expect(assistantStatus(deps({ auth: null }))).toEqual({ configured: false, signInRequired: true });
    expect(assistantStatus(deps({ auth: null, allowAnonymous: true }))).toEqual({ configured: true, signInRequired: false });
  });
});
