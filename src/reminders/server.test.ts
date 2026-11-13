import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { CANDIDATE_PAGE_SIZE, supabaseReminderStore } from "./server";

function pagedClient(total: number) {
  const ranges: [number, number][] = [];
  const rows = Array.from({ length: total }, (_, i) => ({
    user_id: `u${i}`,
    timezone: "UTC",
    reminder_time: "07:00:00",
    last_reminded_on: null,
  }));
  const query = {
    select: () => query,
    not: () => query,
    order: () => query,
    range(from: number, to: number) {
      ranges.push([from, to]);
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    },
  };
  const client = { from: () => query } as unknown as SupabaseClient;
  return { client, ranges };
}

describe("supabaseReminderStore candidates", () => {
  it("pages through every reader with a reminder time instead of stopping at the API row cap", async () => {
    const total = CANDIDATE_PAGE_SIZE * 2 + 3;
    const { client, ranges } = pagedClient(total);
    const candidates = await supabaseReminderStore(client).candidates();
    expect(candidates).toHaveLength(total);
    expect(candidates.at(-1)?.userId).toBe(`u${total - 1}`);
    expect(ranges).toEqual([
      [0, CANDIDATE_PAGE_SIZE - 1],
      [CANDIDATE_PAGE_SIZE, CANDIDATE_PAGE_SIZE * 2 - 1],
      [CANDIDATE_PAGE_SIZE * 2, CANDIDATE_PAGE_SIZE * 3 - 1],
    ]);
  });

  it("stops after one page when there are fewer readers than a page", async () => {
    const { client, ranges } = pagedClient(3);
    expect(await supabaseReminderStore(client).candidates()).toHaveLength(3);
    expect(ranges).toHaveLength(1);
  });
});
