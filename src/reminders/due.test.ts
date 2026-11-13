import { describe, expect, it } from "vitest";
import { dueReminderDate, localClock } from "./due";

const at = (iso: string) => new Date(iso);

describe("localClock", () => {
  it("reads the date and minutes past midnight in the reader's zone", () => {
    expect(localClock(at("2026-06-01T12:30:00Z"), "America/New_York")).toEqual({ date: "2026-06-01", minutes: 8 * 60 + 30 });
    expect(localClock(at("2026-06-01T23:30:00Z"), "Asia/Tokyo")).toEqual({ date: "2026-06-02", minutes: 8 * 60 + 30 });
  });

  it("falls back to UTC for a zone it does not know", () => {
    expect(localClock(at("2026-06-01T12:30:00Z"), "Not/AZone")).toEqual({ date: "2026-06-01", minutes: 12 * 60 + 30 });
  });
});

describe("dueReminderDate", () => {
  const reader = { timezone: "America/New_York", reminderTime: "07:00", lastRemindedOn: null };

  it("is due at the reminder time and a little after it", () => {
    expect(dueReminderDate(reader, at("2026-06-01T11:00:00Z"))).toBe("2026-06-01");
    expect(dueReminderDate(reader, at("2026-06-01T11:14:00Z"))).toBe("2026-06-01");
  });

  it("is not due before the reminder time or once the window has passed", () => {
    expect(dueReminderDate(reader, at("2026-06-01T10:59:00Z"))).toBeNull();
    expect(dueReminderDate(reader, at("2026-06-01T12:01:00Z"))).toBeNull();
  });

  it("is not due again on a day it was already sent", () => {
    expect(dueReminderDate({ ...reader, lastRemindedOn: "2026-06-01" }, at("2026-06-01T11:05:00Z"))).toBeNull();
    expect(dueReminderDate({ ...reader, lastRemindedOn: "2026-05-31" }, at("2026-06-01T11:05:00Z"))).toBe("2026-06-01");
  });

  it("accepts the seconds Postgres adds to a time column", () => {
    expect(dueReminderDate({ ...reader, reminderTime: "07:00:00" }, at("2026-06-01T11:05:00Z"))).toBe("2026-06-01");
  });

  it("follows each reader's own zone for the same instant", () => {
    const now = at("2026-06-01T22:05:00Z");
    expect(dueReminderDate({ ...reader, timezone: "Asia/Tokyo" }, now)).toBe("2026-06-02");
    expect(dueReminderDate(reader, now)).toBeNull();
  });

  it("sends a midnight reminder for the new day to a reader just past midnight", () => {
    const midnight = { ...reader, reminderTime: "00:00" };
    expect(dueReminderDate(midnight, at("2026-06-02T04:05:00Z"))).toBe("2026-06-02");
    expect(dueReminderDate({ ...midnight, lastRemindedOn: "2026-06-01" }, at("2026-06-02T04:05:00Z"))).toBe("2026-06-02");
  });

  it("counts a late-evening reminder caught just after midnight as the previous day's", () => {
    const late = { ...reader, reminderTime: "23:50" };
    expect(dueReminderDate(late, at("2026-06-02T04:10:00Z"))).toBe("2026-06-01");
    expect(dueReminderDate({ ...late, lastRemindedOn: "2026-06-01" }, at("2026-06-02T04:10:00Z"))).toBeNull();
  });

  it("still sends on the morning the clocks spring forward past the reminder time", () => {
    const skipped = { ...reader, reminderTime: "02:30" };
    expect(dueReminderDate(skipped, at("2026-03-08T06:55:00Z"))).toBeNull();
    expect(dueReminderDate(skipped, at("2026-03-08T07:05:00Z"))).toBe("2026-03-08");
  });

  it("sends a reminder set for the start of the skipped hour as soon as the clocks spring forward", async () => {
    const start = { ...reader, reminderTime: "02:00" };
    expect(dueReminderDate(start, at("2026-03-08T06:59:00Z"))).toBeNull();
    expect(dueReminderDate(start, at("2026-03-08T07:00:00Z"))).toBe("2026-03-08");
    expect(dueReminderDate(start, at("2026-03-08T07:30:00Z"))).toBe("2026-03-08");
    expect(dueReminderDate(start, at("2026-03-08T08:01:00Z"))).toBeNull();
  });

  it("sends once when the clocks fall back and the reminder time happens twice", () => {
    const repeated = { ...reader, reminderTime: "01:30" };
    expect(dueReminderDate(repeated, at("2026-11-01T05:35:00Z"))).toBe("2026-11-01");
    expect(dueReminderDate({ ...repeated, lastRemindedOn: "2026-11-01" }, at("2026-11-01T06:35:00Z"))).toBeNull();
  });

  it("is never due without a reminder time", () => {
    expect(dueReminderDate({ ...reader, reminderTime: null }, at("2026-06-01T11:00:00Z"))).toBeNull();
    expect(dueReminderDate({ ...reader, reminderTime: "7am" }, at("2026-06-01T11:00:00Z"))).toBeNull();
  });
});
