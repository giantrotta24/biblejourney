import { existsSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("keeps the Edge seed copy identical to the source of truth", () => {
  const source = new URL("../../content/bible-journey-seed.json", import.meta.url);
  const copy = new URL("../../supabase/functions/_shared/content/bible-journey-seed.json", import.meta.url);
  const fix = "Run: cp content/bible-journey-seed.json supabase/functions/_shared/content/bible-journey-seed.json";
  expect(existsSync(copy), fix).toBe(true);
  expect(readFileSync(copy, "utf8"), fix).toBe(readFileSync(source, "utf8"));
});
