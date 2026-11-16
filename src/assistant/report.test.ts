import { describe, expect, it, vi } from "vitest";
import { memoryCache } from "./cache";
import { handleReport, type AskDeps } from "./handler";
import { memoryLimiter } from "./limiter";
import { PROMPT_VERSION } from "./prompt";
import { DAILY_REPORT_LIMIT, memoryReports } from "./reports";

const TOKEN = "valid-token";
const NOW = new Date("2026-11-15T12:00:00Z");

function deps(overrides: Partial<AskDeps> = {}): AskDeps {
  return {
    model: { stream: async function* () {} },
    auth: { userId: async (token) => (token === TOKEN ? "user-1" : null) },
    access: { allowed: async () => true },
    allowAnonymous: false,
    limiter: memoryLimiter(30),
    anonymousLimiter: memoryLimiter(30),
    cache: memoryCache(),
    modelId: "test-model",
    screen: { screen: async () => "ok", check: async () => "ok" },
    flags: { write: async () => {} },
    reports: memoryReports(),
    now: () => NOW,
    log: { info: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

function report(body: unknown, token: string | null = TOKEN) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/ask/report", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const questionReport = {
  dayIndex: 4,
  kind: "question" as const,
  question: " Why a flood? ",
  answer: "The story is about judgment and mercy.",
  note: "The dates seem off",
};

describe("handleReport", () => {
  it("returns 403 for a signed-in reader without access and stores nothing", async () => {
    const reports = memoryReports();
    const access = { allowed: vi.fn(async () => false) };
    const response = await handleReport(report(questionReport), deps({ reports, access }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: "not_enabled",
      error: "The study assistant is by invitation for now.",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(access.allowed).toHaveBeenCalledExactlyOnceWith("user-1");
    expect(reports.rows).toHaveLength(0);
  });

  it("returns 401 without a token or with a bad token", async () => {
    for (const token of [null, "forged"]) {
      const response = await handleReport(report(questionReport, token), deps());
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ code: "unauthorized" });
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("returns 400 for a report the schema cannot read and stores nothing", async () => {
    const reports = memoryReports();
    const bodies = [
      { dayIndex: 4, kind: "history", question: "Why?", answer: "Because." },
      { dayIndex: 4, kind: "question", answer: "Because." },
      { dayIndex: 4, kind: "question", question: "   ", answer: "Because." },
      { dayIndex: 4, kind: "map", answer: "" },
      { dayIndex: 4, kind: "map", answer: "x".repeat(4001) },
      { dayIndex: 4, kind: "map", answer: "Fine.", note: "n".repeat(301) },
      { dayIndex: 312, kind: "people", answer: "Fine." },
      { dayIndex: 1, kind: "history", answer: "Fine.", extra: true },
      "{not json",
    ];
    for (const body of bodies) {
      const response = await handleReport(report(body), deps({ reports }));
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ code: "invalid" });
    }
    expect(reports.rows).toHaveLength(0);
  });

  it("stores a question report with the server’s model and prompt version", async () => {
    const reports = memoryReports();
    const response = await handleReport(report(questionReport), deps({ reports }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(reports.rows).toEqual([
      {
        userId: "user-1",
        dayIndex: 4,
        kind: "question",
        question: "Why a flood?",
        answer: "The story is about judgment and mercy.",
        note: "The dates seem off",
        model: "test-model",
        promptVersion: PROMPT_VERSION,
        day: "2026-11-15",
      },
    ]);
  });

  it("stores a quick-prompt report without a question", async () => {
    const reports = memoryReports();
    const response = await handleReport(report({ dayIndex: 2, kind: "history", answer: "Ur was a city.", note: "   " }), deps({ reports }));
    expect(response.status).toBe(200);
    expect(reports.rows[0]).toMatchObject({ kind: "history", question: null, note: null, answer: "Ur was a city." });
  });

  it("stores a report only while that reader is under the daily limit", async () => {
    const reports = memoryReports();
    const row = {
      userId: "user-1",
      dayIndex: 0,
      kind: "map" as const,
      question: null,
      answer: "Answer",
      note: null,
      model: "test-model",
      promptVersion: PROMPT_VERSION,
    };
    for (let i = 0; i < DAILY_REPORT_LIMIT - 1; i++) expect(await reports.submit({ ...row, answer: `Answer ${i}` }, NOW)).toBe(true);
    const [kept, dropped] = await Promise.all([
      reports.submit({ ...row, answer: "Ninth" }, NOW),
      reports.submit({ ...row, answer: "Tenth" }, NOW),
    ]);
    expect([kept, dropped].filter(Boolean)).toHaveLength(1);
    expect(reports.rows).toHaveLength(DAILY_REPORT_LIMIT);
    expect(await reports.submit({ ...row, answer: "One more" }, NOW)).toBe(false);
    expect(reports.rows).toHaveLength(DAILY_REPORT_LIMIT);
  });

  it("returns 429 on the 11th report in a UTC day and still accepts another reader", async () => {
    const reports = memoryReports();
    const d = deps({ reports });
    for (let i = 0; i < DAILY_REPORT_LIMIT; i++) {
      const response = await handleReport(report({ dayIndex: 0, kind: "map", answer: `Answer ${i}` }), d);
      expect(response.status).toBe(200);
    }
    const blocked = await handleReport(report({ dayIndex: 0, kind: "map", answer: "One more" }), d);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({
      code: "rate_limited",
      error: "You’ve sent 10 reports today. You can send more tomorrow.",
    });
    expect(reports.rows).toHaveLength(DAILY_REPORT_LIMIT);

    const other = deps({
      reports,
      auth: { userId: async () => "user-2" },
    });
    expect((await handleReport(report({ dayIndex: 0, kind: "map", answer: "From someone else" }), other)).status).toBe(200);
    expect(reports.rows).toHaveLength(DAILY_REPORT_LIMIT + 1);
  });

  it("returns 503 with the not-configured shape when there is nowhere to store reports", async () => {
    const response = await handleReport(report(questionReport), deps({ reports: null }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "not_configured",
      error: "The study assistant isn’t set up on this copy of the app.",
    });
  });

  it("accepts an anonymous report in development without an access check", async () => {
    const reports = memoryReports();
    const access = { allowed: vi.fn(async () => false) };
    const response = await handleReport(
      report({ dayIndex: 0, kind: "people", answer: "A name." }, null),
      deps({ reports, access, allowAnonymous: true, auth: null }),
    );
    expect(response.status).toBe(200);
    expect(access.allowed).not.toHaveBeenCalled();
    expect(reports.rows[0]?.userId).toBe("local-anonymous");
  });

  it("logs only the error name when the write fails", async () => {
    const log = { info: vi.fn(), error: vi.fn() };
    const reports = {
      submit: async () => {
        throw Object.assign(new Error("row included The story is about judgment"), { name: "PostgrestError" });
      },
    };
    const response = await handleReport(report(questionReport), deps({ reports, log }));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "upstream" });
    expect(log.error).toHaveBeenCalledWith({ event: "assistant.error", stage: "report", name: "PostgrestError" });
    expect(JSON.stringify(log.error.mock.calls)).not.toContain("judgment");
  });
});
