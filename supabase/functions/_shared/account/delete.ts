import { withCors } from "../cors.ts";

export type UserVerifier = {
  auth: {
    getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
  };
};

export type UserAdmin = {
  auth: {
    admin: {
      deleteUser(id: string): Promise<{ error: { message: string } | null }>;
    };
  };
};

export type AccountDeleteDeps = {
  configured: boolean;
  verifyUser(token: string): Promise<string | null>;
  deleteUser(id: string): Promise<void>;
};

function json(body: { ok: true } | { error: string }, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function bearer(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return match ? match[1] : null;
}

export function accountDeleteDeps(anon: UserVerifier | null, admin: UserAdmin | null): AccountDeleteDeps {
  return {
    configured: anon != null && admin != null,
    async verifyUser(token) {
      if (!anon) return null;
      const { data, error } = await anon.auth.getUser(token);
      if (error || !data.user) return null;
      return data.user.id;
    },
    async deleteUser(id) {
      if (!admin) throw new Error("missing admin");
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw error;
    },
  };
}

export async function handleAccountDelete(request: Request, deps: AccountDeleteDeps): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { allow: "POST, OPTIONS" } });
  }
  if (!deps.configured) return json({ error: "not_configured" }, 503);
  const token = bearer(request);
  if (!token) return json({ error: "unauthorized" }, 401);
  let userId: string | null;
  try {
    userId = await deps.verifyUser(token);
  } catch {
    return json({ error: "unauthorized" }, 401);
  }
  if (!userId) return json({ error: "unauthorized" }, 401);
  try {
    await deps.deleteUser(userId);
  } catch {
    return json({ error: "upstream" }, 502);
  }
  return json({ ok: true }, 200);
}

export function accountDeleteResponse(request: Request, deps: AccountDeleteDeps, origins: string): Promise<Response> {
  if (request.method === "OPTIONS") return Promise.resolve(withCors(request, null, origins));
  return handleAccountDelete(request, deps).then((response) => withCors(request, response, origins));
}
