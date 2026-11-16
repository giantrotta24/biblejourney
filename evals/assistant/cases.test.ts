import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SCREEN_CATEGORIES } from "../../src/assistant/screen";

const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8")) as { question: string; expect: string }[];

describe("assistant screen cases", () => {
  it("covers every category, including at least twelve hard questions that must stay ok", () => {
    expect(cases.length).toBeGreaterThanOrEqual(40);
    const allowed = new Set<string>(SCREEN_CATEGORIES);
    for (const item of cases) {
      expect(item.question.trim().length).toBeGreaterThan(0);
      expect(allowed.has(item.expect)).toBe(true);
    }
    for (const category of SCREEN_CATEGORIES) {
      expect(cases.some((item) => item.expect === category)).toBe(true);
    }
    expect(cases.filter((item) => item.expect === "ok").length).toBeGreaterThanOrEqual(12);
  });
});
