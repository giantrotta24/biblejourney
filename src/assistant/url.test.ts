import { describe, expect, it } from "vitest";
import { assistantUrl } from "./url";

describe("assistant base URL switch", () => {
  it.each([undefined, "", "   "])("keeps same-origin routes when unset (%s)", (base) => {
    expect(assistantUrl("ask", base)).toBe("/api/ask");
    expect(assistantUrl("ask/report", base)).toBe("/api/ask/report");
  });
  it.each(["https://project.supabase.co/functions/v1", " https://project.supabase.co/functions/v1/// "])("uses the configured function base (%s)", (base) => {
    expect(assistantUrl("ask", base)).toBe("https://project.supabase.co/functions/v1/ask");
    expect(assistantUrl("ask/report", base)).toBe("https://project.supabase.co/functions/v1/ask/report");
  });
});
