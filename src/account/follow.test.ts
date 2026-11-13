import { describe, expect, it } from "vitest";
import { syncAction } from "./follow";

describe("syncAction", () => {
  it("starts syncing for a newly signed-in user", () => {
    expect(syncAction("SIGNED_IN", "a", null)).toBe("start");
    expect(syncAction("INITIAL_SESSION", "a", null)).toBe("start");
    expect(syncAction("SIGNED_IN", "b", "a")).toBe("start");
  });

  it("leaves a running sync alone for the same user", () => {
    expect(syncAction("TOKEN_REFRESHED", "a", "a")).toBe("none");
  });

  it("stops syncing whenever the session goes away while syncing, whatever the event", () => {
    expect(syncAction("SIGNED_OUT", null, "a")).toBe("stop");
    expect(syncAction("TOKEN_REFRESHED", null, "a")).toBe("stop");
    expect(syncAction("INITIAL_SESSION", null, "a")).toBe("stop");
  });

  it("does nothing without a session when nothing is syncing, except unlinking on an explicit sign-out", () => {
    expect(syncAction("INITIAL_SESSION", null, null)).toBe("none");
    expect(syncAction("SIGNED_OUT", null, null)).toBe("stop");
  });
});
