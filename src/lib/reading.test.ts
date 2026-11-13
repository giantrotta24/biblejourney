import { describe, expect, it } from "vitest";
import { bibleGatewayUrl, estimatedMinutes, firstLetters, percentRead } from "./reading";

describe("firstLetters", () => {
  it("turns each word into its first letter and keeps punctuation", () => {
    expect(firstLetters("In the beginning God created the heaven and the earth.")).toBe("I t b G c t h a t e.");
    expect(firstLetters("Hear, O Israel: The LORD our God is one LORD:")).toBe("H, O I: T L o G i o L:");
    expect(firstLetters("send me; or hath he spoken?")).toBe("s m; o h h s?");
  });

  it("treats apostrophes and non-ASCII letters as part of the word", () => {
    expect(firstLetters("It is of the LORD’s mercies")).toBe("I i o t L m");
    expect(firstLetters("in all Judæa, and in Samaria")).toBe("i a J, a i S");
  });
});

describe("bibleGatewayUrl", () => {
  it("links a single passage with NIV by default and a hyphen for the range", () => {
    expect(bibleGatewayUrl("Genesis 1–4")).toBe("https://www.biblegateway.com/passage/?search=Genesis+1-4&version=NIV");
  });

  it("keeps every book of a multi-book day in one search", () => {
    const url = new URL(bibleGatewayUrl("Job 42; Genesis 12–15"));
    expect(url.searchParams.get("search")).toBe("Job 42; Genesis 12-15");
    expect(url.searchParams.get("version")).toBe("NIV");
  });

  it("takes the translation as a parameter", () => {
    expect(new URL(bibleGatewayUrl("Psalms 23", "ESV")).searchParams.get("version")).toBe("ESV");
  });
});

describe("estimatedMinutes", () => {
  it("allows five minutes a chapter with a ten-minute floor", () => {
    expect(estimatedMinutes(1)).toBe(10);
    expect(estimatedMinutes(2)).toBe(10);
    expect(estimatedMinutes(3)).toBe(15);
    expect(estimatedMinutes(6)).toBe(30);
  });
});

describe("percentRead", () => {
  const days = [
    { index: 0, chapters: 30 },
    { index: 1, chapters: 10 },
    { index: 2, chapters: 60 },
  ];

  it("weights by chapters, not days", () => {
    expect(percentRead(new Set([0]), days)).toBe(30);
    expect(percentRead(new Set([1, 2]), days)).toBe(70);
  });

  it("is zero with nothing read and only reaches 100 when everything is read", () => {
    expect(percentRead(new Set(), days)).toBe(0);
    expect(percentRead(new Set([0, 1, 2]), days)).toBe(100);
    expect(percentRead(new Set([0]), [{ index: 0, chapters: 1188 }, { index: 1, chapters: 1 }])).toBe(99);
  });

  it("ignores indexes that are not in the plan", () => {
    expect(percentRead(new Set([0, 99]), days)).toBe(30);
  });
});
