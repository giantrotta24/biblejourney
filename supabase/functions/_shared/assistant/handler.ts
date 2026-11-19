import type { AccessCheck } from "./access.ts";
import { CARE_TEXT } from "./care.ts";
import type { AnswerCache, AnswerKey } from "./cache.ts";
import type { FlagCategory, FlagLog } from "./flags.ts";
import type { UsageLimiter } from "./limiter.ts";
import { buildPrompt, PROMPT_VERSION, type Prompt } from "./prompt.ts";
import { reportRequestSchema, type ReportLog } from "./reports.ts";
import type { SafetyClient, ScreenCategory } from "./screen.ts";
import { askRequestSchema, DAILY_QUESTION_LIMIT, type AskErrorCode, type AskRequest } from "./types.ts";
import { endFrame, withoutMarker, type StreamEnd } from "./wire.ts";

export class AnswerStoppedError extends Error {
  override name = "AnswerStoppedError";
  constructor(readonly stopReason: string) {
    super(`Answer stopped: ${stopReason}`);
  }
}

export interface ModelClient {
  stream(prompt: Prompt, signal: AbortSignal): AsyncIterable<string>;
}

export interface AuthVerifier {
  userId(accessToken: string): Promise<string | null>;
}

export type AssistantLog = {
  info(event: Record<string, string | number | boolean>): void;
  error(event: Record<string, string | number | boolean>): void;
};

export type AskDeps = {
  model: ModelClient | null;
  auth: AuthVerifier | null;
  access: AccessCheck;
  allowAnonymous: boolean;
  limiter: UsageLimiter;
  anonymousLimiter: UsageLimiter;
  cache: AnswerCache;
  modelId: string;
  screen: SafetyClient | null;
  flags: FlagLog;
  reports: ReportLog | null;
  anonymousReports: ReportLog;
  now?: () => Date;
  log?: AssistantLog;
};

export type AssistantStatus = { configured: boolean; signInRequired: boolean; enabled?: boolean };

const ANONYMOUS_USER = "local-anonymous";

export const consoleLog: AssistantLog = {
  info: (event) => console.info(JSON.stringify(event)),
  error: (event) => console.error(JSON.stringify(event)),
};

const MESSAGES: Record<AskErrorCode, string> = {
  not_configured: "The study assistant isn’t set up on this copy of the app.",
  unauthorized: "Please sign in to ask the study assistant.",
  not_enabled: "The study assistant is by invitation for now.",
  rate_limited: `You’ve asked ${DAILY_QUESTION_LIMIT} questions today. The assistant will be ready again tomorrow.`,
  invalid: "That question couldn’t be read. Questions can be up to 500 characters.",
  upstream: "The study assistant couldn’t answer just now. Please try again in a moment.",
};

const STATUS: Record<AskErrorCode, number> = {
  not_configured: 503,
  unauthorized: 401,
  not_enabled: 403,
  rate_limited: 429,
  invalid: 400,
  upstream: 502,
};

function fail(code: AskErrorCode): Response {
  return Response.json({ error: MESSAGES[code], code }, { status: STATUS[code], headers: { "cache-control": "no-store" } });
}

const CANCELLED_STATUS = 499;

function stopEnd(error: unknown): StreamEnd {
  if (!(error instanceof AnswerStoppedError)) return "error";
  if (error.stopReason === "refusal") return "refused";
  if (error.stopReason === "max_tokens" || error.stopReason === "model_context_window_exceeded") return "truncated";
  return "error";
}

function jsonError(code: AskErrorCode, error: string): Response {
  return Response.json({ error, code }, { status: STATUS[code], headers: { "cache-control": "no-store" } });
}

function textResponse(body: BodyInit, cache: "hit" | "miss"): Response {
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-assistant-cache": cache },
  });
}

function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return match ? match[1] : null;
}

async function identify(request: Request, deps: AskDeps): Promise<{ userId: string; limiter: UsageLimiter; anonymous: boolean } | null> {
  const token = bearerToken(request);
  if (!token) return deps.allowAnonymous ? { userId: ANONYMOUS_USER, limiter: deps.anonymousLimiter, anonymous: true } : null;
  if (!deps.auth) return null;
  const userId = await deps.auth.userId(token);
  return userId ? { userId, limiter: deps.limiter, anonymous: false } : null;
}

async function hasAccess(userId: string, deps: AskDeps): Promise<boolean> {
  try {
    return await deps.access.allowed(userId);
  } catch (error) {
    (deps.log ?? consoleLog).error({ event: "assistant.error", stage: "access", name: error instanceof Error ? error.name : "Error" });
    return false;
  }
}

async function readRequest(request: Request): Promise<AskRequest | null> {
  try {
    const parsed = askRequestSchema.safeParse(await request.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function assistantStatus(deps: AskDeps): AssistantStatus {
  const reachable = deps.auth !== null || deps.allowAnonymous;
  return { configured: deps.model !== null && reachable, signInRequired: !deps.allowAnonymous };
}

export async function handleAssistantStatus(request: Request, deps: AskDeps): Promise<Response> {
  const status = assistantStatus(deps);
  const token = bearerToken(request);
  if (token && deps.auth) {
    let userId: string | null = null;
    try {
      userId = await deps.auth.userId(token);
    } catch (error) {
      (deps.log ?? consoleLog).error({ event: "assistant.error", stage: "auth", name: errorName(error) });
    }
    if (userId) status.enabled = await hasAccess(userId, deps);
  }
  return Response.json(status, { headers: { "cache-control": "no-store" } });
}

export async function handleReport(request: Request, deps: AskDeps): Promise<Response> {
  if (!deps.reports) return fail("not_configured");
  const reports = deps.reports;
  const log = deps.log ?? consoleLog;
  const now = deps.now ?? (() => new Date());

  let caller;
  try {
    caller = await identify(request, deps);
  } catch (error) {
    log.error({ event: "assistant.error", stage: "report-auth", name: errorName(error) });
    return fail("upstream");
  }
  if (!caller) return jsonError("unauthorized", "Please sign in to report an answer.");
  if (!caller.anonymous && !(await hasAccess(caller.userId, deps))) return fail("not_enabled");

  let body;
  try {
    const parsed = reportRequestSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("invalid", "That report couldn’t be read.");
    body = parsed.data;
  } catch {
    return jsonError("invalid", "That report couldn’t be read.");
  }

  try {
    const note = body.note?.trim() ? body.note.trim() : null;
    const stored = await (caller.anonymous ? deps.anonymousReports : reports).submit(
      {
        userId: caller.userId,
        dayIndex: body.dayIndex,
        kind: body.kind,
        question: body.kind === "question" ? body.question.trim() : null,
        answer: body.answer,
        note,
        model: deps.modelId,
        promptVersion: PROMPT_VERSION,
      },
      now(),
    );
    if (!stored) return jsonError("rate_limited", "You’ve sent 10 reports today. You can send more tomorrow.");
  } catch (error) {
    log.error({ event: "assistant.error", stage: "report", name: errorName(error) });
    return fail("upstream");
  }

  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}

export async function handleAsk(request: Request, deps: AskDeps): Promise<Response> {
  if (!assistantStatus(deps).configured) return fail("not_configured");

  const upstream = new AbortController();
  const abort = () => upstream.abort();
  if (request.signal.aborted) upstream.abort();
  else request.signal.addEventListener("abort", abort, { once: true });

  const detach = () => request.signal.removeEventListener("abort", abort);
  let streaming = false;
  try {
    return await answer(request, deps, upstream, detach, () => (streaming = true));
  } finally {
    if (!streaming) detach();
  }
}

async function answer(
  request: Request,
  deps: AskDeps,
  upstream: AbortController,
  detach: () => void,
  streamStarted: () => void,
): Promise<Response> {
  const signal = upstream.signal;
  const log = deps.log ?? consoleLog;
  const now = deps.now ?? (() => new Date());
  const model = deps.model!;
  const cancelled = (stage: string) => {
    log.info({ event: "assistant.cancelled", stage });
    return new Response(null, { status: CANCELLED_STATUS });
  };

  let caller;
  try {
    caller = await identify(request, deps);
  } catch (error) {
    log.error({ event: "assistant.error", stage: "auth", name: errorName(error) });
    return fail("upstream");
  }
  if (!caller) return fail("unauthorized");
  if (!caller.anonymous && !(await hasAccess(caller.userId, deps))) return fail("not_enabled");

  const ask = await readRequest(request);
  if (!ask) return fail("invalid");
  const quickType = "type" in ask ? ask.type : null;
  const kind = quickType ?? "question";
  const key: AnswerKey | null = quickType ? { dayIndex: ask.dayIndex, type: quickType, model: deps.modelId, promptVersion: PROMPT_VERSION } : null;

  if (key) {
    const cached = await deps.cache.get(key).catch((error) => {
      log.error({ event: "assistant.error", stage: "cache-read", name: errorName(error) });
      return null;
    });
    if (cached) {
      log.info({ event: "assistant.answer", kind, cached: true, chars: cached.length });
      return textResponse(cached + endFrame("complete"), "hit");
    }
  }

  if (signal.aborted) return cancelled("before-limit");

  let limit;
  try {
    limit = await caller.limiter.take(caller.userId, now());
  } catch (error) {
    log.error({ event: "assistant.error", stage: "limit", name: errorName(error) });
    return fail("upstream");
  }
  if (!limit.allowed) {
    log.info({ event: "assistant.limited", used: limit.used });
    return fail("rate_limited");
  }
  const used = limit.used;
  const release = () =>
    caller.limiter.release(caller.userId, now()).catch((error: unknown) => {
      log.error({ event: "assistant.error", stage: "limit-release", name: errorName(error) });
    });

  if (signal.aborted) {
    await release();
    return cancelled("before-model");
  }

  if (!("type" in ask)) return answerQuestion({ ask, userId: caller.userId, deps, signal, log, model, used, kind, release, cancelled });

  const chunks = model.stream(buildPrompt(ask), signal)[Symbol.asyncIterator]();

  let first: IteratorResult<string>;
  try {
    first = await chunks.next();
  } catch (error) {
    if (signal.aborted) return cancelled("first-chunk");
    if (error instanceof AnswerStoppedError) {
      const end = stopEnd(error);
      log.info({ event: "assistant.answer", kind, cached: false, chars: 0, used, end });
      return textResponse(endFrame(end), "miss");
    }
    log.error({ event: "assistant.error", stage: "model", name: errorName(error) });
    return fail("upstream");
  }

  const encoder = new TextEncoder();
  let text = "";
  const push = (controller: ReadableStreamDefaultController<Uint8Array>, chunk: string) => {
    const clean = withoutMarker(chunk);
    text += clean;
    if (clean) controller.enqueue(encoder.encode(clean));
  };

  async function end(controller: ReadableStreamDefaultController<Uint8Array>, how: StreamEnd) {
    detach();
    controller.enqueue(encoder.encode(endFrame(how)));
    controller.close();
    log.info({ event: "assistant.answer", kind, cached: false, chars: text.length, used, end: how });
    if (how === "complete" && key && text.trim()) {
      await deps.cache.set(key, text).catch((error) => {
        log.error({ event: "assistant.error", stage: "cache-write", name: errorName(error) });
      });
    }
  }

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (!first.done) push(controller, first.value);
    },
    async pull(controller) {
      if (first.done) return end(controller, "complete");
      try {
        const next = await chunks.next();
        if (next.done) return end(controller, "complete");
        push(controller, next.value);
      } catch (error) {
        if (signal.aborted) {
          detach();
          controller.error(error);
          return;
        }
        if (!(error instanceof AnswerStoppedError)) {
          log.error({ event: "assistant.error", stage: "stream", name: errorName(error), chars: text.length });
        }
        return end(controller, stopEnd(error));
      }
    },
    cancel() {
      detach();
      upstream.abort();
      log.info({ event: "assistant.cancelled", stage: "stream", kind, chars: text.length });
    },
  });

  streamStarted();
  return textResponse(body, "miss");
}

type QuestionAsk = Extract<AskRequest, { question: string }>;

async function answerQuestion(input: {
  ask: QuestionAsk;
  userId: string;
  deps: AskDeps;
  signal: AbortSignal;
  log: AssistantLog;
  model: ModelClient;
  used: number;
  kind: string;
  release: () => Promise<void>;
  cancelled: (stage: string) => Response;
}): Promise<Response> {
  const { ask, userId, deps, signal, log, model, used, kind, release, cancelled } = input;

  if (!deps.screen) {
    await release();
    log.error({ event: "assistant.error", stage: "screen", name: "Error" });
    return fail("upstream");
  }
  const screen = deps.screen;

  let category: ScreenCategory;
  try {
    category = await screen.screen(ask.question, signal);
  } catch (error) {
    await release();
    if (signal.aborted) return cancelled("screen");
    log.error({ event: "assistant.error", stage: "screen", name: errorName(error) });
    return fail("upstream");
  }
  if (signal.aborted) {
    await release();
    return cancelled("screen");
  }

  if (category === "crisis") {
    await release();
    await recordFlag(deps, log, { userId: null, dayIndex: ask.dayIndex, category: "crisis" });
    log.info({ event: "assistant.answer", kind, cached: false, chars: CARE_TEXT.length, used, end: "care" });
    return textResponse(CARE_TEXT + endFrame("care"), "miss");
  }

  if (category !== "ok") {
    await recordFlag(deps, log, { userId, dayIndex: ask.dayIndex, category });
    log.info({ event: "assistant.answer", kind, cached: false, chars: 0, used, end: "refused" });
    return textResponse(endFrame("refused"), "miss");
  }

  let collected: { text: string; end: StreamEnd };
  try {
    collected = await collectAnswer(model, buildPrompt(ask), signal, log);
  } catch (error) {
    if (signal.aborted) return cancelled("model");
    log.error({ event: "assistant.error", stage: "model", name: errorName(error) });
    return fail("upstream");
  }

  if (!collected.text) {
    log.info({ event: "assistant.answer", kind, cached: false, chars: 0, used, end: collected.end });
    return textResponse(endFrame(collected.end), "miss");
  }

  let verdict: "ok" | "withhold";
  try {
    verdict = await screen.check(collected.text, signal);
  } catch (error) {
    if (signal.aborted) return cancelled("check");
    log.error({ event: "assistant.error", stage: "check", name: errorName(error) });
    return fail("upstream");
  }

  if (verdict === "withhold") {
    await recordFlag(deps, log, { userId, dayIndex: ask.dayIndex, category: "withheld" });
    log.info({ event: "assistant.answer", kind, cached: false, chars: 0, used, end: "refused" });
    return textResponse(endFrame("refused"), "miss");
  }

  log.info({ event: "assistant.answer", kind, cached: false, chars: collected.text.length, used, end: collected.end });
  return textResponse(collected.text + endFrame(collected.end), "miss");
}

async function collectAnswer(model: ModelClient, prompt: Prompt, signal: AbortSignal, log: AssistantLog): Promise<{ text: string; end: StreamEnd }> {
  const chunks = model.stream(prompt, signal)[Symbol.asyncIterator]();
  let text = "";
  try {
    for (;;) {
      const next = await chunks.next();
      if (next.done) return { text, end: "complete" };
      text += withoutMarker(next.value);
    }
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof AnswerStoppedError) return { text, end: stopEnd(error) };
    if (!text) throw error;
    log.error({ event: "assistant.error", stage: "model", name: errorName(error), chars: text.length });
    return { text, end: "error" };
  }
}

async function recordFlag(deps: AskDeps, log: AssistantLog, flag: { userId: string | null; dayIndex: number; category: FlagCategory }) {
  try {
    await deps.flags.write(flag);
  } catch (error) {
    log.error({ event: "assistant.error", stage: "flag", name: errorName(error) });
  }
}

function errorName(error: unknown): string {
  if (error && typeof error === "object") {
    const status = "status" in error ? (error as { status: unknown }).status : undefined;
    const name = error instanceof Error ? error.name : "Error";
    return typeof status === "number" ? `${name}:${status}` : name;
  }
  return "unknown";
}
