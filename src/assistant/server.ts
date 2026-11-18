import { consoleLog, type AskDeps } from "@server/assistant/handler";
import { createAskDeps } from "@server/assistant/server";

let deps: AskDeps | null = null;

export function serverAskDeps(): AskDeps {
  deps ??= createAskDeps(process.env, consoleLog);
  return deps;
}
