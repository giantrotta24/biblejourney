import { describe, expect, it } from "vitest";
import { anonymousAllowed, assistantModelId, DEFAULT_ASSISTANT_MODEL } from "./config";
import { anthropicModel } from "./model";

function sse(events: object[]): Response {
  const body = events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function messageEvents(texts: string[], stopReason = "end_turn") {
  return [
    {
      type: "message_start",
      message: { id: "msg_1", type: "message", role: "assistant", model: DEFAULT_ASSISTANT_MODEL, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } },
    },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    ...texts.map((text) => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } })),
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 5 } },
    { type: "message_stop" },
  ];
}

function recordingFetch(response: () => Response) {
  const requests: { url: string; body: Record<string, unknown>; headers: Headers }[] = [];
  const fetch = async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    return response();
  };
  return { fetch: fetch as typeof globalThis.fetch, requests };
}

async function collect(stream: AsyncIterable<string>) {
  const parts: string[] = [];
  for await (const part of stream) parts.push(part);
  return parts;
}

describe("config", () => {
  it("defaults the model and lets ANTHROPIC_MODEL override it", () => {
    expect(assistantModelId({})).toBe("claude-sonnet-5-5");
    expect(assistantModelId({ ANTHROPIC_MODEL: " " })).toBe("claude-sonnet-5-5");
    expect(assistantModelId({ ANTHROPIC_MODEL: "claude-opus-5-5" })).toBe("claude-opus-5-5");
  });

  it("allows anonymous use only when switched on outside production", () => {
    expect(anonymousAllowed({ ASSISTANT_ALLOW_ANONYMOUS: "1", NODE_ENV: "development" })).toBe(true);
    expect(anonymousAllowed({ ASSISTANT_ALLOW_ANONYMOUS: "1", NODE_ENV: "production" })).toBe(false);
    expect(anonymousAllowed({ ASSISTANT_ALLOW_ANONYMOUS: "true", NODE_ENV: "development" })).toBe(false);
    expect(anonymousAllowed({ NODE_ENV: "development" })).toBe(false);
  });
});

describe("anthropicModel", () => {
  const prompt = { system: "SYSTEM", user: "USER" };

  it("streams text deltas from the Messages API with the configured model and system prompt", async () => {
    const { fetch, requests } = recordingFetch(() => sse(messageEvents(["Ur ", "of the ", "Chaldeans."])));
    const model = anthropicModel({ apiKey: "test-key", model: "claude-sonnet-5-5", fetch });
    expect(await collect(model.stream(prompt, new AbortController().signal))).toEqual(["Ur ", "of the ", "Chaldeans."]);

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.url).toMatch(/\/v1\/messages/);
    expect(request.headers.get("authorization")).toBe("Bearer test-key");
    expect(request.body).toMatchObject({
      model: "claude-sonnet-5-5",
      stream: true,
      system: "SYSTEM",
      messages: [{ role: "user", content: "USER" }],
      output_config: { effort: "low" },
      fallbacks: "default",
    });
    expect(request.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
  });

  it("leaves fallbacks off for a model that does not take them", async () => {
    const { fetch, requests } = recordingFetch(() => sse(messageEvents(["Hi"])));
    await collect(anthropicModel({ apiKey: "k", model: "claude-haiku-5-5", fetch }).stream(prompt, new AbortController().signal));
    expect(requests[0].body).not.toHaveProperty("fallbacks");
    expect(requests[0].headers.get("anthropic-beta") ?? "").not.toContain("server-side-fallback");
  });

  it("throws when the answer ends in a refusal or is cut off", async () => {
    for (const stop of ["refusal", "max_tokens"]) {
      const { fetch } = recordingFetch(() => sse(messageEvents(["Part"], stop)));
      await expect(collect(anthropicModel({ apiKey: "k", model: "claude-sonnet-5-5", fetch }).stream(prompt, new AbortController().signal))).rejects.toThrow(
        stop,
      );
    }
  });
});
