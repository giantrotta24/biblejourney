import { describe, expect, it } from "vitest";
import raw from "../../content/bible-journey-seed.json";
import { parseSeed } from "./schema";

type RawSeed = typeof raw;

function mutated(change: (seed: RawSeed) => void): RawSeed {
  const copy = structuredClone(raw);
  change(copy);
  return copy;
}

describe("seed file", () => {
  it("parses as it ships", () => {
    const seed = parseSeed(raw);
    const days = seed.weeks.flatMap((week) => week.days);
    expect(seed.weeks).toHaveLength(52);
    expect(days).toHaveLength(312);
    expect(days.reduce((sum, day) => sum + day.chapters, 0)).toBe(1189);
    expect(days.map((day) => day.index)).toEqual(Array.from({ length: 312 }, (_, i) => i));
    expect(seed.weeks.filter((week) => week.memoryVerse.textKJV)).toHaveLength(52);
    expect(seed.eras).toHaveLength(11);
    expect(seed.peoples).toHaveLength(12);
    expect(seed.prophets).toHaveLength(12);
  });

  const broken: Array<[string, (seed: RawSeed) => void, RegExp]> = [
    ["a chapter count changes", (s) => (s.weeks[0].days[0].chapters += 1), /1,189 chapters/],
    ["a week is dropped", (s) => s.weeks.pop(), /52 weeks/],
    ["a week has 5 days", (s) => s.weeks[3].days.pop(), /exactly 6 days/],
    ["a week has 7 days", (s) => s.weeks[3].days.push({ ...s.weeks[3].days[5], index: 999 }), /exactly 6 days/],
    ["a day index is skipped", (s) => (s.weeks[10].days[2].index += 1), /contiguous/],
    ["a week sits in the wrong phase", (s) => (s.weeks[12].phase = 1), /phase/],
    ["a memory verse is empty", (s) => (s.weeks[5].memoryVerse.textKJV = ""), /memory verse/],
    ["weeks are out of order", (s) => ([s.weeks[0], s.weeks[1]] = [s.weeks[1], s.weeks[0]]), /week numbers/],
  ];

  it.each(broken)("fails when %s", (_label, change, message) => {
    expect(() => parseSeed(mutated(change))).toThrow(message);
  });
});
