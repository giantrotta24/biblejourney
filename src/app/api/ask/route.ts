import { connection } from "next/server";
import { handleAssistantStatus, handleAsk } from "@server/assistant/handler";
import { serverAskDeps } from "@/assistant/server";

export async function GET(request: Request) {
  await connection();
  return handleAssistantStatus(request, serverAskDeps());
}

export async function POST(request: Request) {
  return handleAsk(request, serverAskDeps());
}
