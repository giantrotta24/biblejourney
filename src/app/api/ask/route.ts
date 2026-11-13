import { connection } from "next/server";
import { assistantStatus, handleAsk } from "@/assistant/handler";
import { serverAskDeps } from "@/assistant/server";

export async function GET() {
  await connection();
  return Response.json(assistantStatus(serverAskDeps()), { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  return handleAsk(request, serverAskDeps());
}
