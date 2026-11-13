import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emailSignInError, signInWithEmail, verifyEmailCode } from "./session";

const fake = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("./supabase", () => ({
  accountsConfigured: false,
  authRedirectUrl: () => "https://example.com/account",
  supabaseClient: async () => ({ auth: fake }) as unknown as SupabaseClient,
}));

beforeEach(() => {
  fake.signInWithOtp.mockReset().mockResolvedValue({ error: null });
  fake.verifyOtp.mockReset().mockResolvedValue({ error: null });
});

describe("email sign-in", () => {
  it("requests and verifies an email code while retaining the browser link redirect and leading zero", async () => {
    await signInWithEmail("reader@example.com");
    expect(fake.signInWithOtp).toHaveBeenCalledExactlyOnceWith({
      email: "reader@example.com",
      options: { emailRedirectTo: "https://example.com/account" },
    });
    await expect(verifyEmailCode("reader@example.com", "012345")).resolves.toBeUndefined();
    expect(fake.verifyOtp).toHaveBeenCalledExactlyOnceWith({ email: "reader@example.com", token: "012345", type: "email" });
  });

  it("passes send and verification errors to the caller", async () => {
    const error = { status: 429, code: "over_email_send_rate_limit" };
    fake.signInWithOtp.mockResolvedValue({ error });
    await expect(signInWithEmail("reader@example.com")).rejects.toBe(error);
    const invalidCode = { status: 403, code: "otp_expired" };
    fake.verifyOtp.mockResolvedValue({ error: invalidCode });
    await expect(verifyEmailCode("reader@example.com", "012345")).rejects.toBe(invalidCode);
  });
});

describe("email sign-in error messages", () => {
  it.each([
    { status: 429 },
    { code: "over_email_send_rate_limit" },
    { code: "over_request_rate_limit" },
  ])("explains a rate limit without exposing server text: %j", (details) => {
    expect(emailSignInError({ ...details, message: "private server detail" })).toEqual({
      kind: "rate-limit",
      message: "An email was sent recently. Please wait before asking for another code.",
    });
  });

  it.each(["otp_expired", "invalid_credentials"])("explains an incorrect or expired code: %s", (code) => {
    expect(emailSignInError({ code, status: 403, message: "private server detail" })).toEqual({
      kind: "invalid-code",
      message: "That code is incorrect or has expired. Check it or send a new code.",
    });
  });

  it.each([
    new TypeError("Failed to fetch"),
    { name: "AuthRetryableFetchError", status: 0 },
  ])("explains a network failure: %j", (error) => {
    expect(emailSignInError(error)).toEqual({
      kind: "network",
      message: "You may be offline. Check your connection and try again.",
    });
  });

  it("accepts offline state as an argument without reading browser globals", () => {
    expect(emailSignInError(new Error("private server detail"), false).kind).toBe("network");
  });

  it.each([null, undefined, "private server detail", new Error("private server detail"), { status: 500 }, { status: 403 }])(
    "uses calm fallback copy for other failures: %j",
    (error) => {
      expect(emailSignInError(error)).toEqual({
        kind: "other",
        message: "Sign-in didn’t go through. Please try again.",
      });
    },
  );
});
