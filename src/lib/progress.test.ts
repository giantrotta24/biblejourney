import { describe, expect, it } from "vitest";
import { CHAPTER_COUNT, DAY_COUNT, days, WEEK_COUNT } from "@/content/plan";
import {
  catchUpDays,
  currentWeek,
  currentEraIndex,
  isWeekComplete,
  nextVerseWeek,
  progressStats,
  sundayWeek,
  unlockedWeeks,
  weekMask,
  weekState,
} from "./progress";

const range = (from: number, to: number) => new Set(Array.from({ length: to - from }, (_, i) => from + i));

describe("weekMask and weekState", () => {
  it("sets one bit per read day of the week", () => {
    expect(weekMask(new Set([6, 8, 11]), 2)).toBe(0b100101);
    expect(weekMask(new Set([0, 1]), 2)).toBe(0);
  });

  it("calls a week empty, partial or full", () => {
    expect(weekState(new Set(), 1)).toBe("empty");
    expect(weekState(new Set([3]), 1)).toBe("partial");
    expect(weekState(range(0, 6), 1)).toBe("full");
    expect(isWeekComplete(range(0, 6), 1)).toBe(true);
    expect(isWeekComplete(range(0, 5), 1)).toBe(false);
  });
});

describe("currentWeek", () => {
  it("is the week of the first unread day, not the furthest", () => {
    expect(currentWeek(new Set())).toBe(1);
    expect(currentWeek(new Set([0, 1, 2, 3, 4, 5, 40]))).toBe(2);
    expect(currentWeek(new Set([1, 2, 100]))).toBe(1);
  });

  it("is null once every day is read", () => {
    expect(currentWeek(range(0, DAY_COUNT))).toBeNull();
  });
});

describe("progressStats", () => {
  it("weights the percentage by chapters, not days", () => {
    const longest = days.reduce((a, b) => (b.chapters > a.chapters ? b : a));
    const stats = progressStats({ days: new Set([longest.index]), verses: new Set([1, 2]) });
    expect(stats.percent).toBe(Math.floor((longest.chapters / CHAPTER_COUNT) * 100));
    expect(stats.daysDone).toBe(1);
    expect(stats.versesLearned).toBe(2);
  });

  it("labels the percentage as under 1% until a whole percent is read, and 0% only with nothing read", () => {
    expect(progressStats({ days: new Set(), verses: new Set() }).percentLabel).toBe("0%");
    expect(progressStats({ days: new Set([0]), verses: new Set() }).percentLabel).toBe("<1%");
    expect(progressStats({ days: range(0, 20), verses: new Set() }).percentLabel).toMatch(/^[1-9]\d*%$/);
    expect(progressStats({ days: range(0, DAY_COUNT - 1), verses: new Set() }).percentLabel).not.toBe("100%");
    expect(progressStats({ days: range(0, DAY_COUNT), verses: new Set() }).percentLabel).toBe("100%");
  });

  it("reaches 100 only when every chapter is read", () => {
    expect(progressStats({ days: range(0, DAY_COUNT - 1), verses: new Set() }).percent).toBeLessThan(100);
    expect(progressStats({ days: range(0, DAY_COUNT), verses: new Set() }).percent).toBe(100);
  });
});

describe("unlockedWeeks", () => {
  it("unlocks every verse up to and including the current week", () => {
    expect(unlockedWeeks(new Set())).toEqual([1]);
    expect(unlockedWeeks(range(0, 13))).toEqual([1, 2, 3]);
  });

  it("unlocks all 52 when the plan is finished", () => {
    expect(unlockedWeeks(range(0, DAY_COUNT))).toHaveLength(WEEK_COUNT);
  });
});

describe("nextVerseWeek", () => {
  it("never repeats the verse on screen when there is a choice", () => {
    const pool = [1, 2, 3];
    expect(nextVerseWeek(pool, 1, () => 0)).toBe(2);
    expect(nextVerseWeek(pool, 3, () => 0.99)).toBe(2);
    expect(nextVerseWeek(pool, 2, () => 0.5)).toBe(3);
  });

  it("stays put with a single unlocked verse", () => {
    expect(nextVerseWeek([1], 1, () => 0.7)).toBe(1);
  });
});

describe("sundayWeek", () => {
  it("is the week just finished when reading stops at its Saturday", () => {
    expect(sundayWeek(range(0, 6), null)).toBe(1);
    expect(sundayWeek(range(0, 18), null)).toBe(3);
  });

  it("is null mid-week, before any reading, or once the next week is started", () => {
    expect(sundayWeek(new Set(), null)).toBeNull();
    expect(sundayWeek(range(0, 4), null)).toBeNull();
  });

  it("survives ticking a day ahead in a later week", () => {
    expect(sundayWeek(range(0, 7), null)).toBe(1);
    expect(sundayWeek(new Set([...range(0, 6), 40]), null)).toBe(1);
  });

  it("follows the highest complete week when the reader unticks and re-ticks", () => {
    const done = range(0, 12);
    expect(sundayWeek(done, 1)).toBe(2);
    done.delete(11);
    expect(sundayWeek(done, null)).toBe(1);
    expect(sundayWeek(done, 1)).toBeNull();
    done.add(11);
    expect(sundayWeek(done, 1)).toBe(2);
  });

  it("needs all six days of that week, not only the Saturday", () => {
    expect(sundayWeek(new Set([5]), null)).toBeNull();
    expect(sundayWeek(new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((i) => i !== 8)), null)).toBe(1);
  });

  it("still shows when an earlier week has gaps", () => {
    const done = range(0, 12);
    done.delete(2);
    expect(sundayWeek(done, null)).toBe(2);
  });

  it("is null once the reader has moved on from that Sunday", () => {
    expect(sundayWeek(range(0, 6), 1)).toBeNull();
    expect(sundayWeek(range(0, 12), 1)).toBe(2);
  });

  it("is null when the whole plan is read", () => {
    expect(sundayWeek(range(0, DAY_COUNT), null)).toBeNull();
  });
});

describe("catchUpDays", () => {
  it("lists unread days up to the end of the given week, in plan order", () => {
    const done = range(0, 12);
    done.delete(2);
    done.delete(9);
    expect(catchUpDays(done, 2).map((day) => day.index)).toEqual([2, 9]);
    expect(catchUpDays(range(0, 12), 2)).toEqual([]);
  });
});

describe("currentEraIndex", () => {
  const eras = [{ weeks: [1, 5] as const }, { weeks: [5, 12] as const }, { weeks: [13, 15] as const }];

  it("sits on the era whose week range holds the first unread day's week", () => {
    expect(currentEraIndex(new Set(), eras)).toBe(0);
    expect(currentEraIndex(range(0, 6 * 12 + 1), eras)).toBe(2);
  });

  it("takes the later era when ranges share a week", () => {
    expect(currentEraIndex(range(0, 6 * 4), eras)).toBe(1);
  });

  it("stays on the last era once the plan is finished", () => {
    expect(currentEraIndex(range(0, DAY_COUNT), eras)).toBe(2);
  });

  it("holds the previous era across a gap between ranges", () => {
    expect(currentEraIndex(range(0, 6 * 5 + 1), [{ weeks: [1, 3] as const }, { weeks: [8, 10] as const }])).toBe(0);
  });
});
