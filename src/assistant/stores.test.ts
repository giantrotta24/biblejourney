import { describe, expect, it } from "vitest";
import { memoryCache } from "./cache";
import { memoryLimiter, utcDay } from "./limiter";

const at = (iso: string) => new Date(iso);

describe("utcDay", () => {
  it("uses the UTC calendar day", () => {
    expect(utcDay(at("2026-11-13T23:59:59-05:00"))).toBe("2026-11-14");
    expect(utcDay(at("2026-11-13T00:00:00Z"))).toBe("2026-11-13");
  });
});

describe("memoryLimiter", () => {
  it("allows up to the limit per user per day, then refuses", async () => {
    const limiter = memoryLimiter(3);
    const now = at("2026-11-13T10:00:00Z");
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await limiter.take("a", now));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.used)).toEqual([1, 2, 3, 3]);
  });

  it("counts each user separately", async () => {
    const limiter = memoryLimiter(1);
    const now = at("2026-11-13T10:00:00Z");
    expect((await limiter.take("a", now)).allowed).toBe(true);
    expect((await limiter.take("b", now)).allowed).toBe(true);
    expect((await limiter.take("a", now)).allowed).toBe(false);
  });

  it("starts fresh on the next UTC day", async () => {
    const limiter = memoryLimiter(1);
    expect((await limiter.take("a", at("2026-11-13T23:59:00Z"))).allowed).toBe(true);
    expect((await limiter.take("a", at("2026-11-13T23:59:30Z"))).allowed).toBe(false);
    expect((await limiter.take("a", at("2026-11-14T00:00:01Z"))).allowed).toBe(true);
  });
});

describe("memoryCache", () => {
  it("stores answers per day index and prompt type", async () => {
    const cache = memoryCache();
    expect(await cache.get(3, "map")).toBeNull();
    await cache.set(3, "map", "The answer");
    expect(await cache.get(3, "map")).toBe("The answer");
    expect(await cache.get(3, "people")).toBeNull();
    expect(await cache.get(4, "map")).toBeNull();
  });
});
