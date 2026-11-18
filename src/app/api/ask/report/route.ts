import { handleReport } from "@server/assistant/handler";
import { serverAskDeps } from "@/assistant/server";

export async function POST(request: Request) {
  return handleReport(request, serverAskDeps());
}
