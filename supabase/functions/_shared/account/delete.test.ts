import { describe, expect, it, vi } from "vitest";
import { accountDeleteDeps, accountDeleteResponse, type UserAdmin, type UserVerifier } from "./delete.ts";

function fakeClients(options?: {
  userId?: string | null;
  throwVerify?: boolean;
  throwDelete?: boolean;
  verifyGone?: boolean;
  deleteGone?: boolean;
}) {
  const calls: { method: string; arg: string }[] = [];
  const anon: UserVerifier = {
    auth: {
      async getUser(token) {
        calls.push({ method: "getUser", arg: token });
        if (options?.throwVerify) throw new Error("auth down");
        if (options?.verifyGone) {
          return {
            data: { user: null },
            error: { message: "User from sub claim in JWT does not exist", status: 403, code: "user_not_found" },
          };
        }
        const id = options?.userId === undefined ? "user-1" : options.userId;
        return { data: { user: id ? { id } : null }, error: id ? null : { message: "bad", status: 403, code: "bad_jwt" } };
      },
    },
  };
  const admin: UserAdmin = {
    auth: {
      admin: {
        async deleteUser(id) {
          calls.push({ method: "deleteUser", arg: id });
          if (options?.deleteGone) return { error: { message: "User not found", status: 404, code: "user_not_found" } };
          if (options?.throwDelete) return { error: { message: "db" } };
          return { error: null };
        },
      },
    },
  };
  return { anon, admin, calls };
}

const post = (token?: string) =>
  new Request("https://edge.example/account-delete", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

describe("account-delete", () => {
  it("rejects a method other than POST", async () => {
    const { anon, admin } = fakeClients();
    const response = await accountDeleteResponse(new Request("https://edge.example/account-delete", { method: "GET" }), accountDeleteDeps(anon, admin), "");
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST, OPTIONS");
  });

  it("requires a bearer token before it reports that delete is not configured", async () => {
    const missing = await accountDeleteResponse(post(), accountDeleteDeps(fakeClients().anon, fakeClients().admin), "");
    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ error: "unauthorized" });

    const unconfigured = await accountDeleteResponse(post(), accountDeleteDeps(null, null), "");
    expect(unconfigured.status).toBe(401);

    const { anon, admin, calls } = fakeClients({ userId: null });
    const bad = await accountDeleteResponse(post("nope"), accountDeleteDeps(anon, admin), "");
    expect(bad.status).toBe(401);
    expect(calls[0]).toEqual({ method: "getUser", arg: "nope" });
    expect(calls.some((call) => call.method === "deleteUser")).toBe(false);
  });

  it("answers 502 when verifying the user throws, and logs the message without the token", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const thrown = fakeClients({ throwVerify: true });
      const failed = await accountDeleteResponse(post("good"), accountDeleteDeps(thrown.anon, thrown.admin), "");
      expect(failed.status).toBe(502);
      expect(await failed.json()).toEqual({ error: "upstream" });
      expect(errorSpy).toHaveBeenCalledWith("auth down");
      expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("good");
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("treats a missing user as already deleted and does not call delete again", async () => {
    const { anon, admin, calls } = fakeClients({ verifyGone: true });
    const response = await accountDeleteResponse(post("access-token"), accountDeleteDeps(anon, admin), "");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(calls.map((call) => call.method)).toEqual(["getUser"]);
  });

  it("treats deleteUser user-not-found as success", async () => {
    const { anon, admin, calls } = fakeClients({ deleteGone: true });
    const response = await accountDeleteResponse(post("access-token"), accountDeleteDeps(anon, admin), "");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(calls.map((call) => call.method)).toEqual(["getUser", "deleteUser"]);
  });

  it("deletes the verified user", async () => {
    const { anon, admin, calls } = fakeClients();
    const response = await accountDeleteResponse(post("access-token"), accountDeleteDeps(anon, admin), "");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(calls[0]?.arg).toBe("access-token");
    expect(calls[1]).toEqual({ method: "deleteUser", arg: "user-1" });
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("reports an upstream delete failure and a missing env", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const broken = fakeClients({ throwDelete: true });
      const upstream = await accountDeleteResponse(post("access-token"), accountDeleteDeps(broken.anon, broken.admin), "");
      expect(upstream.status).toBe(502);
      expect(await upstream.json()).toEqual({ error: "upstream" });
      expect(errorSpy).toHaveBeenCalledWith("db");
      expect(errorSpy.mock.calls.flat().join(" ")).not.toContain("access-token");

      const missing = await accountDeleteResponse(post("access-token"), accountDeleteDeps(null, null), "");
      expect(missing.status).toBe(503);
      expect(await missing.json()).toEqual({ error: "not_configured" });
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("answers a preflight without an allow-origin header", async () => {
    const { anon, admin } = fakeClients();
    const response = await accountDeleteResponse(
      new Request("https://edge.example/account-delete", { method: "OPTIONS", headers: { origin: "https://app.example" } }),
      accountDeleteDeps(anon, admin),
      "",
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});
