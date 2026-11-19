import { consoleLog, handleAsk, handleAssistantStatus, handleReport } from "../_shared/assistant/handler.ts";
import { createAskDeps } from "../_shared/assistant/server.ts";
import { withCors } from "../_shared/cors.ts";
import { edgeEnv } from "../_shared/env.ts";

const env = edgeEnv(Deno.env.toObject());
const deps = createAskDeps(env, consoleLog);

Deno.serve(async (request) => {
  let response: Response;
  if (request.method === "OPTIONS") {
    return withCors(request, null, env.ASSISTANT_ALLOWED_ORIGINS ?? "");
  }
  if (request.method === "GET") {
    response = await handleAssistantStatus(request, deps);
  } else if (request.method === "POST") {
    response = await (new URL(request.url).pathname.endsWith("/report") ? handleReport : handleAsk)(request, deps);
  } else {
    response = new Response(null, { status: 405, headers: { Allow: "GET, POST, OPTIONS" } });
  }
  return withCors(request, response, env.ASSISTANT_ALLOWED_ORIGINS ?? "");
});
