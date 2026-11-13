import { describe, expect, it, vi } from "vitest";
import { memoryCache } from "./cache";
import { assistantStatus, handleAsk, type AskDeps, type ModelClient } from "./handler";
import { memoryLimiter } from "./limiter";
import type { Prompt } from "./prompt";
import { DAILY_QUESTION_LIMIT } from "./types";

const TOKEN = "valid-token";
const NOW = new Date("2026-11-13T12:00:00Z");

function fakeModel(chunks: string[] = ["Abram ", "travels ", "south."], failAfter?: number) {
  const prompts: Prompt[] = [];
  const model: ModelClient = {
    async *stream(prompt) {
      prompts.push(prompt);
      for (const [i, chunk] of chunks.entries()) {
        if (failAfter !== undefined && i === failAfter) throw new Error("upstream broke");
        yield chunk;
      }
      if (failAfter !== undefined && failAfter >= chunks.length) throw new Error("upstream broke");
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
    now: () => NOW,
    log: { info: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

function ask(body: unknown, token: string | null = TOKEN) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/ask", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("handleAsk", () => {
  it("streams the answer as plain text", async () => {
    const response = await handleAsk(ask({ dayIndex: 0, type: "history" }), deps());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("x-assistant-cache")).toBe("miss");
    expect(await response.text()).toBe("Abram travels south.");
  });

  it("returns 503 when no model is configured", async () => {
    const response = await handleAsk(ask({ dayIndex: 0, type: "history" }), deps({ model: null }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "not_configured" });
  });

  it("returns 401 without a token, with a bad token, and when accounts are not configured", async () => {
    for (const [request, d] of [
      [ask({ dayIndex: 0, type: "map" }, null), deps()],
      [ask({ dayIndex: 0, type: "map" }, "forged"), deps()],
      [ask({ dayIndex: 0, type: "map" }), deps({ auth: null })],
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
    expect(await response.json()).toMatchObject({ code: "rate_limited", error: expect.stringMatching(/30/) });
    expect(prompts).toHaveLength(DAILY_QUESTION_LIMIT);
  });

  it("serves a repeated quick prompt from the cache without calling the model or counting it", async () => {
    const { model, prompts } = fakeModel();
    const limiter = memoryLimiter(1);
    const d = deps({ model, limiter });
    const first = await handleAsk(ask({ dayIndex: 4, type: "people" }), d);
    expect(await first.text()).toBe("Abram travels south.");

    const second = await handleAsk(ask({ dayIndex: 4, type: "people" }), d);
    expect(second.status).toBe(200);
    expect(second.headers.get("x-assistant-cache")).toBe("hit");
    expect(await second.text()).toBe("Abram travels south.");
    expect(prompts).toHaveLength(1);
  });

  it("does not cache free-text answers or answers that broke off", async () => {
    const cache = memoryCache();
    await (await handleAsk(ask({ dayIndex: 1, question: "Why?" }), deps({ cache }))).text();
    const broken = await handleAsk(ask({ dayIndex: 1, type: "map" }), deps({ cache, model: fakeModel(["Half ", "an"], 1).model }));
    expect(broken.status).toBe(200);
    await expect(broken.text()).rejects.toThrow();
    expect(await cache.get(1, "map")).toBeNull();
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

describe("assistantStatus", () => {
  it("says whether the assistant is set up and whether sign-in is needed", () => {
    expect(assistantStatus(deps({ model: null }))).toEqual({ configured: false, signInRequired: true });
    expect(assistantStatus(deps())).toEqual({ configured: true, signInRequired: true });
    expect(assistantStatus(deps({ allowAnonymous: true }))).toEqual({ configured: true, signInRequired: false });
  });
});
