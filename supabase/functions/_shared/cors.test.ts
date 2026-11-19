import { describe, expect, it } from "vitest";
import { withCors } from "./cors.ts";

const allowed = " https://app.example, http://localhost:3000 ";
const request = (origin?: string, method = "GET") => new Request("https://edge.example/ask", { method, headers: origin ? { origin } : {} });

describe("assistant CORS", () => {
  it("echoes only an exact listed origin and preserves response headers and body", async () => {
    const response = withCors(request("https://app.example"), new Response("answer", { headers: { "x-assistant-cache": "hit", vary: "Accept" } }), allowed);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.example");
    expect(response.headers.get("vary")).toBe("Accept, Origin");
    expect(response.headers.get("access-control-expose-headers")).toContain("x-assistant-cache");
    expect(await response.text()).toBe("answer");
  });
  it.each(["https://app.example.evil", "https://elsewhere.example", "null", undefined])("does not grant CORS to %s", (origin) => {
    const response = withCors(request(origin), new Response("ok"), allowed);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("access-control-allow-headers")).toBeNull();
    expect(response.headers.get("vary")).toContain("Origin");
  });
  it("answers allowed preflights with 204, methods and the client headers", () => {
    const response = withCors(request("http://localhost:3000", "OPTIONS"), null, allowed);
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, POST, OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toBe("authorization, content-type");
  });
  it("does not grant a disallowed preflight or an empty allowlist", () => {
    expect(withCors(request("https://evil.example", "OPTIONS"), null, allowed).status).toBe(204);
    expect(withCors(request("https://evil.example", "OPTIONS"), null, allowed).headers.get("access-control-allow-origin")).toBeNull();
    expect(withCors(request("https://app.example"), new Response(), "").headers.get("access-control-allow-origin")).toBeNull();
  });
});
