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
  signInWithGoogle: vi.fn<() => Promise<void>>(),
  signOut: vi.fn<() => Promise<void>>(),
}));

vi.mock("@/account/session", () => ({
  useAccount: () => session.account,
  useSyncStatus: () => session.status,
  useRejectedChanges: () => session.rejected,
  signInWithEmail: session.signInWithEmail,
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
  session.signInWithGoogle.mockReset();
  session.signOut.mockReset();
});

afterEach(cleanup);

describe("sign-in view", () => {
  it("shows a waiting state while the link is sent, then focuses the confirmation", async () => {
    const sending = deferred();
    session.signInWithEmail.mockReturnValue(sending.promise);
    page();
    const status = screen.getByRole("status");
    expect(status.tabIndex).toBe(-1);

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: "Email me a sign-in link" }));

    const waiting = await screen.findByRole("button", { name: "Sending a link…" });
    expect(waiting.getAttribute("aria-busy")).toBe("true");
    expect((waiting as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Continue with Google" }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => sending.resolve());
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toContain("reader@example.com");
    expect(document.activeElement).toBe(status);
    expect(status.className).toContain("[overflow-wrap:anywhere]");
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
