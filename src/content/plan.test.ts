import { describe, expect, it } from "vitest";
import { currentDay, days, getPhase, getWeek, weekDayIndexes } from "./plan";

describe("plan content", () => {
  it("flattens days with their week and position", () => {
    expect(days).toHaveLength(312);
    expect(days[7]).toMatchObject({ index: 7, week: 2, position: 1 });
  });

  it("looks up weeks and phases", () => {
    expect(getWeek(1).title).toBe("Creation and the early world");
    expect(getPhase(getWeek(40).phase).weeks).toEqual([40, 52]);
    expect(() => getWeek(53)).toThrow(RangeError);
  });

  it("lists a week's day indexes", () => {
    expect(weekDayIndexes(2)).toEqual([6, 7, 8, 9, 10, 11]);
  });

  it("takes the first unread day as today, not a calendar date", () => {
    expect(currentDay(new Set())?.index).toBe(0);
    expect(currentDay(new Set([0, 1, 3]))?.index).toBe(2);
    expect(currentDay(new Set(days.map((d) => d.index)))).toBeNull();
  });
});
