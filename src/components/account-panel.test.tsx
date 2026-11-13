// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountState } from "@/account/session";
import type { SyncStatus } from "@/sync/engine";

const session = vi.hoisted(() => ({
  account: { status: "signed-out" } as AccountState,
  status: "synced" as SyncStatus,
  rejected: 0,
  signInWithEmail: vi.fn<(email: string) => Promise<void>>(),
  verifyEmailCode: vi.fn<(email: string, code: string) => Promise<void>>(),
  signInWithGoogle: vi.fn<() => Promise<void>>(),
  signOut: vi.fn<() => Promise<void>>(),
}));

vi.mock("@/account/session", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/account/session")>(),
  useAccount: () => session.account,
  useSyncStatus: () => session.status,
  useRejectedChanges: () => session.rejected,
  signInWithEmail: session.signInWithEmail,
  verifyEmailCode: session.verifyEmailCode,
  signInWithGoogle: session.signInWithGoogle,
  signOut: session.signOut,
}));

const { AccountPanel } = await import("./account-panel");

function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

function page() {
  return render(
    <>
      <h1 id="account-heading" tabIndex={-1}>Account</h1>
      <AccountPanel />
    </>,
  );
}

beforeEach(() => {
  session.account = { status: "signed-out" };
  session.status = "synced";
  session.rejected = 0;
  session.signInWithEmail.mockReset();
  session.verifyEmailCode.mockReset();
  session.signInWithGoogle.mockReset();
  session.signOut.mockReset();
});

afterEach(cleanup);

describe("sign-in view", () => {
  it("shows a waiting state while the email is sent, then focuses the code field", async () => {
    const sending = deferred();
    session.signInWithEmail.mockReturnValue(sending.promise);
    page();
    const status = screen.getByRole("status");
    expect(status.tabIndex).toBe(-1);

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: " reader@example.com " } });
    fireEvent.submit(screen.getByRole("button", { name: "Email me a code" }));

    const waiting = await screen.findByRole("button", { name: "Sending a code…" });
    expect(waiting.getAttribute("aria-busy")).toBe("true");
    expect((waiting as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Continue with Google" }) as HTMLButtonElement).disabled).toBe(true);
    expect(session.signInWithEmail).toHaveBeenCalledExactlyOnceWith("reader@example.com");

    await act(async () => sending.resolve());
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toContain("reader@example.com");
    const code = screen.getByLabelText("Email code");
    expect(document.activeElement).toBe(code);
    expect(code.getAttribute("inputmode")).toBe("numeric");
    expect(code.getAttribute("autocomplete")).toBe("one-time-code");
    expect(status.className).toContain("[overflow-wrap:anywhere]");
    expect(screen.getByText("In your phone’s home-screen app, enter the code here because the email link opens in your browser.")).toBeTruthy();
  });

  async function requestCode() {
    const view = page();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
    await act(async () => fireEvent.submit(screen.getByRole("button", { name: "Email me a code" })));
    return view;
  }

  it.each(["012345", "1234567", "12345678", "123456789", "0123456789"])("verifies a %s code and waits for the account subscription", async (token) => {
    const verifying = deferred();
    session.verifyEmailCode.mockReturnValue(verifying.promise);
    const view = await requestCode();
    const code = screen.getByLabelText("Email code") as HTMLInputElement;
    fireEvent.change(code, { target: { value: token } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }));

    const waiting = screen.getByRole("button", { name: "Signing in…" }) as HTMLButtonElement;
    expect(waiting.disabled).toBe(true);
    expect(waiting.getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button", { name: "Send a new code" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Use a different email" }) as HTMLButtonElement).disabled).toBe(true);
    expect(session.verifyEmailCode).toHaveBeenCalledExactlyOnceWith("reader@example.com", token);

    await act(async () => verifying.resolve());
    expect(screen.getByLabelText("Email code")).toBe(code);
    session.account = { status: "signed-in", userId: "u1", email: "reader@example.com" };
    view.rerender(<AccountPanel />);
    expect(screen.getByText("Signed in as reader@example.com.")).toBeTruthy();
    expect(screen.queryByLabelText("Email code")).toBeNull();
  });

  it("strips spaces from a pasted code without losing a leading zero", async () => {
    await requestCode();
    const code = screen.getByLabelText("Email code") as HTMLInputElement;
    fireEvent.change(code, { target: { value: " 012 345 6789 " } });
    expect(code.value).toBe("0123456789");
    await act(async () => fireEvent.submit(screen.getByRole("button", { name: "Sign in" })));
    expect(session.verifyEmailCode).toHaveBeenCalledExactlyOnceWith("reader@example.com", "0123456789");
  });

  it.each(["", "12345", "12345678901", "12345a", "123-456"])("rejects malformed code %j before calling verification", async (token) => {
    await requestCode();
    const code = screen.getByLabelText("Email code") as HTMLInputElement;
    fireEvent.change(code, { target: { value: token } });
    await act(async () => fireEvent.submit(screen.getByRole("button", { name: "Sign in" })));
    expect(session.verifyEmailCode).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("Enter the 6–10 digit code from your email.");
    expect(document.activeElement).toBe(code);
  });

  it("announces a wrong code and keeps its value selected for another try", async () => {
    session.verifyEmailCode.mockRejectedValue({ code: "otp_expired", status: 403, message: "private server detail" });
    await requestCode();
    const status = screen.getByRole("status");
    const code = screen.getByLabelText("Email code") as HTMLInputElement;
    fireEvent.change(code, { target: { value: "012345" } });
    screen.getByRole("button", { name: "Sign in" }).focus();
    await act(async () => fireEvent.submit(screen.getByRole("button", { name: "Sign in" })));
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toContain("That code is incorrect or has expired. Check it or send a new code.");
    expect(status.textContent).not.toContain("private server detail");
    expect(code.value).toBe("012345");
    expect(document.activeElement).toBe(code);
    expect(code.selectionStart).toBe(0);
    expect(code.selectionEnd).toBe(6);
    fireEvent.change(code, { target: { value: "654321" } });
    session.verifyEmailCode.mockResolvedValue();
    await act(async () => fireEvent.submit(screen.getByRole("button", { name: "Sign in" })));
    expect(status.textContent).not.toContain("That code is incorrect");
  });

  it.each([{ status: 429 }, { code: "over_email_send_rate_limit" }])("keeps code entry available after an initial rate limit: %j", async (error) => {
    session.signInWithEmail.mockRejectedValue(error);
    await requestCode();
    expect(screen.getByRole("status").textContent).toContain("An email was sent recently. Please wait before asking for another code.");
    expect(document.activeElement).toBe(screen.getByLabelText("Email code"));
    fireEvent.change(screen.getByLabelText("Email code"), { target: { value: "123456" } });
    await act(async () => fireEvent.submit(screen.getByRole("button", { name: "Sign in" })));
    expect(session.verifyEmailCode).toHaveBeenCalledExactlyOnceWith("reader@example.com", "123456");
  });

  it("resends to the retained address, disables concurrent actions, and keeps a code after a rate limit", async () => {
    await requestCode();
    const code = screen.getByLabelText("Email code") as HTMLInputElement;
    const status = screen.getByRole("status");
    fireEvent.change(code, { target: { value: "012345" } });
    const sending = deferred();
    session.signInWithEmail.mockReturnValue(sending.promise);
    const resend = screen.getByRole("button", { name: "Send a new code" }) as HTMLButtonElement;
    fireEvent.click(resend);
    expect(resend.disabled).toBe(true);
    expect(resend.getAttribute("aria-busy")).toBe("true");
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Use a different email" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(resend);
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }));
    expect(session.signInWithEmail).toHaveBeenCalledTimes(2);
    expect(session.signInWithEmail).toHaveBeenLastCalledWith("reader@example.com");
    expect(session.verifyEmailCode).not.toHaveBeenCalled();
    await act(async () => sending.resolve());
    expect(resend.disabled).toBe(false);
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toContain("A new code is on its way.");
    expect(document.activeElement).toBe(code);
    expect(code.value).toBe("");

    fireEvent.change(code, { target: { value: "654321" } });
    session.signInWithEmail.mockRejectedValue({ status: 429, message: "private server detail" });
    await act(async () => fireEvent.click(resend));
    expect(screen.getByLabelText("Email code")).toBe(code);
    expect(code.value).toBe("654321");
    expect(status.textContent).toContain("An email was sent recently. Please wait before asking for another code.");
    expect(status.textContent).not.toContain("private server detail");
    expect(resend.disabled).toBe(false);
  });

  it("returns to the retained email and focuses it, then sends to a different address", async () => {
    await requestCode();
    const status = screen.getByRole("status");
    fireEvent.change(screen.getByLabelText("Email code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Use a different email" }));
    const email = screen.getByLabelText("Email address") as HTMLInputElement;
    expect(email.value).toBe("reader@example.com");
    expect(document.activeElement).toBe(email);
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toBe("");
    fireEvent.change(email, { target: { value: "other@example.com" } });
    await act(async () => fireEvent.submit(screen.getByRole("button", { name: "Email me a code" })));
    expect(session.signInWithEmail).toHaveBeenLastCalledWith("other@example.com");
    expect((screen.getByLabelText("Email code") as HTMLInputElement).value).toBe("");
  });

  it.each([
    [new TypeError("Failed to fetch"), "You may be offline. Check your connection and try again."],
    [new Error("private server detail"), "Sign-in didn’t go through. Please try again."],
  ])("announces send failures without server details: %j", async (error, message) => {
    session.signInWithEmail.mockRejectedValue(error);
    await requestCode();
    expect(screen.getByRole("status").textContent).toBe(message);
    expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe("reader@example.com");
    expect((screen.getByRole("button", { name: "Email me a code" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps a code available to retry after a network failure", async () => {
    await requestCode();
    const code = screen.getByLabelText("Email code") as HTMLInputElement;
    session.verifyEmailCode.mockRejectedValue({ name: "AuthRetryableFetchError", status: 0 });
    fireEvent.change(code, { target: { value: "123456" } });
    await act(async () => fireEvent.submit(screen.getByRole("button", { name: "Sign in" })));
    expect(code.value).toBe("123456");
    expect(screen.getByRole("status").textContent).toContain("You may be offline. Check your connection and try again.");
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("puts focus on the Account heading after signing out", async () => {
    session.account = { status: "signed-in", userId: "u1", email: "a-very-long-address@example.com" };
    session.signOut.mockResolvedValue();
    const view = page();
    expect(screen.getByText(/Signed in as/).className).toContain("[overflow-wrap:anywhere]");

    const button = screen.getByRole("button", { name: "Sign out" });
    button.focus();
    await act(async () => fireEvent.click(button));
    session.account = { status: "signed-out" };
    view.rerender(
      <>
        <h1 id="account-heading" tabIndex={-1}>Account</h1>
        <AccountPanel />
      </>,
    );
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Account" }));
  });
});

describe("signed-in status", () => {
  it("replaces the synced sentence with the refusal when changes were rejected", () => {
    session.account = { status: "signed-in", userId: "u1", email: "reader@example.com" };
    session.rejected = 2;
    page();
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("2 changes could not be synced.");
    expect(screen.queryByText(/up to date on every device/)).toBeNull();
  });
});
