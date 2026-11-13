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
    ["a week sits in the wrong phase", (s) => (s.weeks[12].phase = 1), /Week 13 says phase 1, but the phase ranges put it in phase 2/],
    ["a phase range runs backwards", (s) => (s.phases[1].weeks = [26, 13]), /starts after it ends/],
    ["phase ranges leave a gap", (s) => (s.phases[1].weeks = [14, 26]), /tile weeks 1–52/],
    ["phase ranges overlap", (s) => (s.phases[0].weeks = [1, 13]), /tile weeks 1–52/],
    ["phase ids are not 1 to 4", (s) => (s.phases[3].id = 5), /Phase ids must be 1–4/],
    ["a week's days are out of order", (s) => ([s.weeks[2].days[0].weekday, s.weeks[2].days[1].weekday] = ["Tue", "Mon"]), /Mon–Sat in order/],
    ["meta.readingDays disagrees", (s) => (s.meta.readingDays = 311), /readingDays/],
    ["meta.totalChapters disagrees", (s) => (s.meta.totalChapters = 1188), /totalChapters/],
    ["a memory verse is empty", (s) => (s.weeks[5].memoryVerse.textKJV = ""), /memory verse/],
    ["weeks are out of order", (s) => ([s.weeks[0], s.weeks[1]] = [s.weeks[1], s.weeks[0]]), /week numbers/],
  ];

  it.each(broken)("fails when %s", (_label, change, message) => {
    expect(() => parseSeed(mutated(change))).toThrow(message);
  });
});
