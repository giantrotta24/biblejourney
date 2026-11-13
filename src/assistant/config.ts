export const DEFAULT_ASSISTANT_MODEL = "claude-sonnet-5-5";

type Env = Record<string, string | undefined>;

export function assistantModelId(env: Env): string {
  return env.ANTHROPIC_MODEL?.trim() || DEFAULT_ASSISTANT_MODEL;
}

export function anonymousAllowed(env: Env): boolean {
  return env.ASSISTANT_ALLOW_ANONYMOUS === "1" && env.NODE_ENV !== "production";
}
