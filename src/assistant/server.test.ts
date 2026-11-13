import { describe, expect, it, vi } from "vitest";
import { assistantSetup } from "./config";
import { assistantStatus, handleAsk } from "./handler";
import { createAskDeps } from "./server";

const FULL = {
  ANTHROPIC_API_KEY: "sk-ant-secret-value",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-secret-value",
  SUPABASE_SERVICE_ROLE_KEY: "service-secret-value",
};

function without(name: keyof typeof FULL, extra: Record<string, string> = {}) {
  const env: Record<string, string> = { ...FULL, ...extra };
  delete env[name];
  return env;
}

describe("assistantSetup", () => {
  it("in production needs the Anthropic key, Supabase auth and the service role key", () => {
    expect(assistantSetup({ ...FULL, NODE_ENV: "production" })).toEqual({ ready: true, missing: [], anonymous: false });
    expect(assistantSetup(without("SUPABASE_SERVICE_ROLE_KEY", { NODE_ENV: "production" })).missing).toEqual(["SUPABASE_SERVICE_ROLE_KEY"]);
    expect(assistantSetup(without("NEXT_PUBLIC_SUPABASE_ANON_KEY", { NODE_ENV: "production" })).missing).toEqual(["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
    expect(assistantSetup({ ANTHROPIC_API_KEY: "k", ASSISTANT_ALLOW_ANONYMOUS: "1", NODE_ENV: "production" }).ready).toBe(false);
  });

  it("in development needs Supabase auth unless anonymous mode is on, and never the service role key", () => {
    expect(assistantSetup({ ANTHROPIC_API_KEY: "k", NODE_ENV: "development" })).toEqual({
      ready: false,
      missing: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
      anonymous: false,
    });
    expect(assistantSetup({ ANTHROPIC_API_KEY: "k", ASSISTANT_ALLOW_ANONYMOUS: "1", NODE_ENV: "development" })).toEqual({
      ready: true,
      missing: [],
      anonymous: true,
    });
    expect(assistantSetup(without("SUPABASE_SERVICE_ROLE_KEY", { NODE_ENV: "development" })).ready).toBe(true);
  });

  it("is never ready without the Anthropic key", () => {
    expect(assistantSetup({ NODE_ENV: "development", ASSISTANT_ALLOW_ANONYMOUS: "1" }).missing).toEqual(["ANTHROPIC_API_KEY"]);
  });
});

describe("createAskDeps", () => {
  it("in production without the service role key reports not configured, returns 503 and logs the missing name once", async () => {
    const log = { info: vi.fn(), error: vi.fn() };
    const deps = createAskDeps(without("SUPABASE_SERVICE_ROLE_KEY", { NODE_ENV: "production" }), log);
    expect(assistantStatus(deps)).toEqual({ configured: false, signInRequired: true });
    const response = await handleAsk(new Request("http://localhost/api/ask", { method: "POST", body: "{}" }), deps);
    expect(response.status).toBe(503);

    const lines = [...log.info.mock.calls, ...log.error.mock.calls];
    expect(lines).toHaveLength(1);
    const text = JSON.stringify(lines);
    expect(text).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(text).not.toMatch(/secret-value|example\.supabase/);
  });

  it("in development with only the Anthropic key and anonymous mode off reports not configured", () => {
    const log = { info: vi.fn(), error: vi.fn() };
    const deps = createAskDeps({ ANTHROPIC_API_KEY: "k", NODE_ENV: "development" }, log);
    expect(assistantStatus(deps)).toEqual({ configured: false, signInRequired: true });
    expect(JSON.stringify(log.error.mock.calls)).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("is configured in production with everything set", () => {
    const log = { info: vi.fn(), error: vi.fn() };
    const deps = createAskDeps({ ...FULL, NODE_ENV: "production" }, log);
    expect(assistantStatus(deps)).toEqual({ configured: true, signInRequired: true });
    expect(log.error).not.toHaveBeenCalled();
  });
});
