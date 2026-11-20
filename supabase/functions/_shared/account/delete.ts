import { withCors } from "../cors.ts";

export type AuthFailure = { message: string; status?: number; code?: string };

export type UserVerifier = {
  auth: {
    getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: AuthFailure | null }>;
  };
};

export type UserAdmin = {
  auth: {
    admin: {
      deleteUser(id: string): Promise<{ error: AuthFailure | null }>;
    };
  };
};

export type VerifiedUser = { status: "user"; id: string } | { status: "gone" } | { status: "unauthorized" };

export type AccountDeleteDeps = {
  configured: boolean;
  verifyUser(token: string): Promise<VerifiedUser>;
  deleteUser(id: string): Promise<void>;
};

function json(body: { ok: true } | { error: string }, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function bearer(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return match ? match[1] : null;
}

/** Auth ≥2.145 answers 403 `user_not_found`. Older Auth answers 404 for a missing user. */
function userIsGone(error: AuthFailure | null): boolean {
  if (!error) return false;
  return error.code === "user_not_found" || error.status === 404;
}

function failureMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message) {
    return error.message;
  }
  return "upstream";
}

export function accountDeleteDeps(anon: UserVerifier | null, admin: UserAdmin | null): AccountDeleteDeps {
  return {
    configured: anon != null && admin != null,
    async verifyUser(token) {
      if (!anon) return { status: "unauthorized" };
      const { data, error } = await anon.auth.getUser(token);
      if (userIsGone(error)) return { status: "gone" };
      if (error || !data.user) return { status: "unauthorized" };
      return { status: "user", id: data.user.id };
    },
    async deleteUser(id) {
      if (!admin) throw new Error("missing admin");
      const { error } = await admin.auth.admin.deleteUser(id);
      if (userIsGone(error)) return;
      if (error) throw error;
    },
  };
}

export async function handleAccountDelete(request: Request, deps: AccountDeleteDeps): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "POST, OPTIONS" } });
  }
  const token = bearer(request);
  if (!token) return json({ error: "unauthorized" }, 401);
  if (!deps.configured) return json({ error: "not_configured" }, 503);
  let verified: VerifiedUser;
  try {
    verified = await deps.verifyUser(token);
  } catch (error) {
    console.error(failureMessage(error));
    return json({ error: "upstream" }, 502);
  }
  if (verified.status === "gone") return json({ ok: true }, 200);
  if (verified.status !== "user") return json({ error: "unauthorized" }, 401);
  try {
    await deps.deleteUser(verified.id);
  } catch (error) {
    console.error(failureMessage(error));
    return json({ error: "upstream" }, 502);
  }
  return json({ ok: true }, 200);
}

export function accountDeleteResponse(request: Request, deps: AccountDeleteDeps, origins: string): Promise<Response> {
  if (request.method === "OPTIONS") return Promise.resolve(withCors(request, null, origins));
  return handleAccountDelete(request, deps).then((response) => withCors(request, response, origins));
}
