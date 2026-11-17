import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXTENSIONS = [".ts", ".tsx", ".js", ".mjs"];

export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL && (specifier.startsWith("./") || specifier.startsWith("../"))) {
    const url = new URL(specifier, context.parentURL);
    const path = fileURLToPath(url);
    if (!existsSync(path)) {
      for (const ext of EXTENSIONS) {
        if (existsSync(path + ext)) return nextResolve(specifier + ext, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
