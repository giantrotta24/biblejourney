import { readFileSync } from "node:fs";

const key = process.env.ANTHROPIC_API_KEY?.trim();
if (!key) {
  console.log("ANTHROPIC_API_KEY is not set, so the assistant screen eval was skipped.");
  process.exit(0);
}

const { screenModelId } = await import("../src/assistant/config");
const { anthropicSafety } = await import("../src/assistant/screen");

const cases = JSON.parse(readFileSync(new URL("../evals/assistant/cases.json", import.meta.url), "utf8")) as {
  question: string;
  expect: string;
}[];

const safety = anthropicSafety({ apiKey: key, model: screenModelId(process.env) });
const mismatches: { expect: string; got: string; question: string }[] = [];

for (const item of cases) {
  let got: string;
  try {
    got = await safety.screen(item.question, AbortSignal.timeout(30_000));
  } catch (error) {
    got = error instanceof Error ? error.name : "Error";
  }
  if (got !== item.expect) mismatches.push({ expect: item.expect, got, question: item.question });
}

if (mismatches.length > 0) {
  console.table(mismatches);
  process.exit(1);
}

console.log(`${cases.length} screen cases matched.`);
