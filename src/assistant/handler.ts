import type { AnswerCache } from "./cache";
import type { UsageLimiter } from "./limiter";
import { buildPrompt, type Prompt } from "./prompt";
import { askRequestSchema, DAILY_QUESTION_LIMIT, type AskErrorCode, type AskRequest } from "./types";

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
  allowAnonymous: boolean;
  limiter: UsageLimiter;
  anonymousLimiter: UsageLimiter;
  cache: AnswerCache;
  now?: () => Date;
  log?: AssistantLog;
};

export type AssistantStatus = { configured: boolean; signInRequired: boolean };

const ANONYMOUS_USER = "local-anonymous";

const consoleLog: AssistantLog = {
  info: (event) => console.info(JSON.stringify(event)),
  error: (event) => console.error(JSON.stringify(event)),
};

const MESSAGES: Record<AskErrorCode, string> = {
  not_configured: "The study assistant isn’t set up on this copy of the app.",
  unauthorized: "Please sign in to ask the study assistant.",
  rate_limited: `You’ve asked ${DAILY_QUESTION_LIMIT} questions today, which is the daily limit. You can ask more tomorrow (the count resets at midnight UTC).`,
  invalid: "That question couldn’t be read. Questions can be up to 500 characters.",
  upstream: "The study assistant couldn’t answer just now. Please try again in a moment.",
};

const STATUS: Record<AskErrorCode, number> = {
  not_configured: 503,
  unauthorized: 401,
  rate_limited: 429,
  invalid: 400,
  upstream: 502,
};

function fail(code: AskErrorCode): Response {
  return Response.json({ error: MESSAGES[code], code }, { status: STATUS[code], headers: { "cache-control": "no-store" } });
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

async function identify(request: Request, deps: AskDeps): Promise<{ userId: string; limiter: UsageLimiter } | null> {
  const token = bearerToken(request);
  if (!token) return deps.allowAnonymous ? { userId: ANONYMOUS_USER, limiter: deps.anonymousLimiter } : null;
  if (!deps.auth) return null;
  const userId = await deps.auth.userId(token);
  return userId ? { userId, limiter: deps.limiter } : null;
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
  return { configured: deps.model !== null, signInRequired: !deps.allowAnonymous };
}

export async function handleAsk(request: Request, deps: AskDeps): Promise<Response> {
  const log = deps.log ?? consoleLog;
  const now = deps.now ?? (() => new Date());
  const model = deps.model;
  if (!model) return fail("not_configured");

  let caller;
  try {
    caller = await identify(request, deps);
  } catch (error) {
    log.error({ event: "assistant.error", stage: "auth", name: errorName(error) });
    return fail("upstream");
  }
  if (!caller) return fail("unauthorized");

  const ask = await readRequest(request);
  if (!ask) return fail("invalid");
  const quickType = "type" in ask ? ask.type : null;
  const kind = quickType ?? "question";

  if (quickType) {
    const cached = await deps.cache.get(ask.dayIndex, quickType).catch((error) => {
      log.error({ event: "assistant.error", stage: "cache-read", name: errorName(error) });
      return null;
    });
    if (cached) {
      log.info({ event: "assistant.answer", kind, cached: true, chars: cached.length });
      return textResponse(cached, "hit");
    }
  }

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

  const dayIndex = ask.dayIndex;
  const upstream = new AbortController();
  const abort = () => upstream.abort();
  request.signal.addEventListener("abort", abort);
  const chunks = model.stream(buildPrompt(ask), upstream.signal)[Symbol.asyncIterator]();

  let first: IteratorResult<string>;
  try {
    first = await chunks.next();
  } catch (error) {
    request.signal.removeEventListener("abort", abort);
    log.error({ event: "assistant.error", stage: "model", name: errorName(error) });
    return fail("upstream");
  }

  const encoder = new TextEncoder();
  let answer = "";
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      if (first.done) return;
      answer += first.value;
      controller.enqueue(encoder.encode(first.value));
    },
    async pull(controller) {
      if (first.done) return finish(controller);
      try {
        const next = await chunks.next();
        if (next.done) return finish(controller);
        answer += next.value;
        controller.enqueue(encoder.encode(next.value));
      } catch (error) {
        request.signal.removeEventListener("abort", abort);
        log.error({ event: "assistant.error", stage: "stream", name: errorName(error), chars: answer.length });
        controller.error(error);
      }
    },
    cancel() {
      request.signal.removeEventListener("abort", abort);
      upstream.abort();
      log.info({ event: "assistant.cancelled", kind, chars: answer.length });
    },
  });

  async function finish(controller: ReadableStreamDefaultController<Uint8Array>) {
    request.signal.removeEventListener("abort", abort);
    controller.close();
    log.info({ event: "assistant.answer", kind, cached: false, chars: answer.length, used });
    if (quickType && answer.trim()) {
      await deps.cache.set(dayIndex, quickType, answer).catch((error) => {
        log.error({ event: "assistant.error", stage: "cache-write", name: errorName(error) });
      });
    }
  }

  return textResponse(body, "miss");
}

function errorName(error: unknown): string {
  if (error && typeof error === "object") {
    const status = "status" in error ? String((error as { status: unknown }).status) : "";
    const name = error instanceof Error ? error.name : "Error";
    return status ? `${name}:${status}` : name;
  }
  return "unknown";
}
