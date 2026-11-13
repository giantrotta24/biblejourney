import { describe, expect, it } from "vitest";
import seed from "../../content/bible-journey-seed.json";

const days = seed.weeks.flatMap((week) => week.days);

describe("seed file", () => {
  it("covers all 1,189 chapters in 312 reading days", () => {
    expect(days).toHaveLength(312);
    expect(days.reduce((sum, day) => sum + day.chapters, 0)).toBe(1189);
  });

  it("has 52 weeks of exactly 6 days", () => {
    expect(seed.weeks).toHaveLength(52);
    for (const week of seed.weeks) expect(week.days).toHaveLength(6);
  });

  it("numbers days 0 to 311 in order", () => {
    expect(days.map((day) => day.index)).toEqual(Array.from({ length: 312 }, (_, i) => i));
  });
});
