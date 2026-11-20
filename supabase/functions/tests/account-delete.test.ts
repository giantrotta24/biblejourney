import { accountDeleteDeps, accountDeleteResponse, type UserAdmin, type UserVerifier } from "../_shared/account/delete.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function fakeClients(options?: { userId?: string | null; throwVerify?: boolean; throwDelete?: boolean }) {
  const calls: { method: string; arg: string }[] = [];
  const anon: UserVerifier = {
    auth: {
      async getUser(token) {
        calls.push({ method: "getUser", arg: token });
        if (options?.throwVerify) throw new Error("auth down");
        const id = options?.userId === undefined ? "user-1" : options.userId;
        return { data: { user: id ? { id } : null }, error: id ? null : { message: "bad" } };
      },
    },
  };
  const admin: UserAdmin = {
    auth: {
      admin: {
        async deleteUser(id) {
          calls.push({ method: "deleteUser", arg: id });
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

Deno.test("account-delete rejects a method other than POST", async () => {
  const { anon, admin } = fakeClients();
  const response = await accountDeleteResponse(new Request("https://edge.example/account-delete", { method: "GET" }), accountDeleteDeps(anon, admin), "");
  assert(response.status === 405, `status ${response.status}`);
  assert(response.headers.get("allow") === "POST, OPTIONS", `allow ${response.headers.get("allow")}`);
});

Deno.test("account-delete requires a bearer token and a real user", async () => {
  const missing = await accountDeleteResponse(post(), accountDeleteDeps(fakeClients().anon, fakeClients().admin), "");
  assert(missing.status === 401, `missing ${missing.status}`);
  assert((await missing.json()).error === "unauthorized", "missing body");

  const { anon, admin, calls } = fakeClients({ userId: null });
  const bad = await accountDeleteResponse(post("nope"), accountDeleteDeps(anon, admin), "");
  assert(bad.status === 401, `bad ${bad.status}`);
  assert(calls[0]?.method === "getUser" && calls[0]?.arg === "nope", "token was not passed to getUser");
  assert(!calls.some((call) => call.method === "deleteUser"), "delete ran without a user");

  const thrown = fakeClients({ throwVerify: true });
  const failed = await accountDeleteResponse(post("good"), accountDeleteDeps(thrown.anon, thrown.admin), "");
  assert(failed.status === 401, `thrown ${failed.status}`);
});

Deno.test("account-delete deletes the verified user", async () => {
  const { anon, admin, calls } = fakeClients();
  const response = await accountDeleteResponse(post("access-token"), accountDeleteDeps(anon, admin), "");
  assert(response.status === 200, `status ${response.status}`);
  assert(JSON.stringify(await response.json()) === JSON.stringify({ ok: true }), "body");
  assert(calls[0]?.arg === "access-token", "verify token");
  assert(calls[1]?.method === "deleteUser" && calls[1]?.arg === "user-1", "delete id");
  assert(response.headers.get("access-control-allow-origin") == null, "native request gained an origin");
});

Deno.test("account-delete reports an upstream delete failure and a missing env", async () => {
  const broken = fakeClients({ throwDelete: true });
  const upstream = await accountDeleteResponse(post("access-token"), accountDeleteDeps(broken.anon, broken.admin), "");
  assert(upstream.status === 502, `upstream ${upstream.status}`);
  assert((await upstream.json()).error === "upstream", "upstream body");

  const missing = await accountDeleteResponse(post("access-token"), accountDeleteDeps(null, null), "");
  assert(missing.status === 503, `config ${missing.status}`);
  assert((await missing.json()).error === "not_configured", "config body");
});

Deno.test("account-delete answers a listed preflight and leaves other origins alone", async () => {
  const { anon, admin } = fakeClients();
  const deps = accountDeleteDeps(anon, admin);
  const allowed = await accountDeleteResponse(
    new Request("https://edge.example/account-delete", { method: "OPTIONS", headers: { origin: "https://app.example" } }),
    deps,
    "https://app.example",
  );
  assert(allowed.status === 204, `preflight ${allowed.status}`);
  assert(allowed.headers.get("access-control-allow-origin") === "https://app.example", "origin");
  const denied = await accountDeleteResponse(
    new Request("https://edge.example/account-delete", { method: "POST", headers: { origin: "https://evil.example", authorization: "Bearer access-token" } }),
    deps,
    "https://app.example",
  );
  assert(denied.status === 200, `post ${denied.status}`);
  assert(denied.headers.get("access-control-allow-origin") == null, "evil origin");
});
