import Anthropic from "@anthropic-ai/sdk";
import type { ModelClient } from "./handler";

const MAX_TOKENS = 8000;
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const MODELS_WITH_FALLBACKS = new Set(["claude-fable-5-2", "claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export class IncompleteAnswerError extends Error {
  override name = "IncompleteAnswerError";
}

export function anthropicModel(options: { apiKey: string; model: string; fetch?: typeof globalThis.fetch }): ModelClient {
  const client = new Anthropic({ apiKey: options.apiKey, authToken: null, fetch: options.fetch });
  const fallbacks = MODELS_WITH_FALLBACKS.has(options.model);

  return {
    async *stream(prompt, signal) {
      const stream = client.beta.messages.stream(
        {
          model: options.model,
          max_tokens: MAX_TOKENS,
          system: prompt.system,
          messages: [{ role: "user", content: prompt.user }],
          output_config: { effort: "low" },
          ...(fallbacks ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
        },
        { signal },
      );

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
      }

      const message = await stream.finalMessage();
      if (message.stop_reason !== "end_turn") throw new IncompleteAnswerError(`Answer stopped: ${message.stop_reason}`);
    },
  };
}
