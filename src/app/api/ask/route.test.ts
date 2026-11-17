import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AskDeps } from "@/assistant/handler";
import { memoryCache } from "@/assistant/cache";
import { memoryLimiter } from "@/assistant/limiter";

const server = vi.hoisted(() => ({ deps: null as AskDeps | null }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/assistant/server", () => ({ serverAskDeps: () => server.deps }));

const { GET } = await import("./route");

beforeEach(() => {
  server.deps = {
    model: { stream: vi.fn() },
    auth: { userId: vi.fn(async (token) => token === "valid" ? "user-1" : null) },
    access: { allowed: vi.fn(async () => true) },
    allowAnonymous: false,
    limiter: memoryLimiter(30),
    anonymousLimiter: memoryLimiter(30),
    cache: memoryCache(),
    modelId: "test",
    screen: { screen: async () => "ok", check: async () => "ok" },
    flags: { write: async () => {} },
    reports: { submit: async () => true },
    anonymousReports: { submit: async () => true },
    log: { info: vi.fn(), error: vi.fn() },
  };
});

const request = (token?: string) => new Request("http://localhost/api/ask", { headers: token ? { authorization: `Bearer ${token}` } : {} });

describe("GET /api/ask", () => {
  it.each([true, false])("returns enabled: %s for a verified account", async (enabled) => {
    vi.mocked(server.deps!.access.allowed).mockResolvedValue(enabled);
    const response = await GET(request("valid"));
    expect(await response.json()).toEqual({ configured: true, signInRequired: true, enabled });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(server.deps!.access.allowed).toHaveBeenCalledExactlyOnceWith("user-1");
  });

  it.each([undefined, "forged"])("keeps the public status shape for token %s", async (token) => {
    const response = await GET(request(token));
    expect(await response.json()).toEqual({ configured: true, signInRequired: true });
    expect(server.deps!.access.allowed).not.toHaveBeenCalled();
  });

  it("reports disabled on an access error without exposing the error details", async () => {
    vi.mocked(server.deps!.access.allowed).mockRejectedValue(new Error("secret user and SQL details"));
    const response = await GET(request("valid"));
    expect(await response.json()).toEqual({ configured: true, signInRequired: true, enabled: false });
    expect(server.deps!.log!.error).toHaveBeenCalledExactlyOnceWith({ event: "assistant.error", stage: "access", name: "Error" });
  });

  it("keeps the public status on an auth error without leaking details", async () => {
    vi.mocked(server.deps!.auth!.userId).mockRejectedValue(new Error("secret token"));
    const response = await GET(request("valid"));
    expect(await response.json()).toEqual({ configured: true, signInRequired: true });
    expect(server.deps!.access.allowed).not.toHaveBeenCalled();
    expect(server.deps!.log!.error).toHaveBeenCalledExactlyOnceWith({ event: "assistant.error", stage: "auth", name: "Error" });
  });
});
