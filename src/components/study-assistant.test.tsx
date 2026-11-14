// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountState } from "@/account/session";

const session = vi.hoisted(() => ({
  account: { status: "signed-in", userId: "u1", email: "reader@example.com" } as AccountState,
  token: vi.fn(async (): Promise<string | null> => "valid-token"),
}));
vi.mock("@/account/session", () => ({ useAccount: () => session.account }));
vi.mock("@/account/supabase", () => ({ getAccessToken: session.token }));

const { StudyAssistant } = await import("./study-assistant");
const INVITATION = "The study assistant is by invitation for now.";
const fetchMock = vi.fn<typeof fetch>();
const status = (enabled: boolean) => Response.json({ configured: true, signInRequired: true, enabled });

beforeEach(() => {
  session.account = { status: "signed-in", userId: "u1", email: "reader@example.com" };
  session.token.mockReset().mockResolvedValue("valid-token");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("assistant invitations", () => {
  it("checks with the bearer token and shows only the invitation line without access", async () => {
    fetchMock.mockResolvedValue(status(false));
    render(<StudyAssistant dayIndex={0} />);
    await screen.findByText(INVITATION);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/ask", { cache: "no-store", headers: { authorization: "Bearer valid-token" } });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("keeps the question flow available for an invited account", async () => {
    fetchMock.mockResolvedValueOnce(status(true)).mockResolvedValueOnce(new Response("An answer.\u001Ecomplete"));
    render(<StudyAssistant dayIndex={3} />);
    fireEvent.click(await screen.findByRole("button", { name: "Historical setting" }));
    await screen.findByText("An answer.");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/ask", expect.objectContaining({
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer valid-token" },
      body: JSON.stringify({ dayIndex: 3, type: "history" }),
    }));
  });

  it("removes the form when access is revoked after the availability check", async () => {
    fetchMock.mockResolvedValueOnce(status(true)).mockResolvedValueOnce(Response.json({ code: "not_enabled", error: INVITATION }, { status: 403 }));
    render(<StudyAssistant dayIndex={0} />);
    fireEvent.click(await screen.findByRole("button", { name: "Historical setting" }));
    await screen.findByText(INVITATION);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("rechecks on account changes and hides the previous account's form while checking", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockResolvedValueOnce(status(true)).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const view = render(<StudyAssistant dayIndex={0} />);
    await screen.findByRole("textbox");
    session.account = { status: "signed-in", userId: "u2", email: null };
    session.token.mockResolvedValue("second-token");
    view.rerender(<StudyAssistant dayIndex={0} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await act(async () => finish(status(false)));
    await screen.findByText(INVITATION);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/ask", { cache: "no-store", headers: { authorization: "Bearer second-token" } });
  });

  it("rechecks after sign-in and ignores an old account's late status response", async () => {
    let finish!: (response: Response) => void;
    session.account = { status: "signed-out" };
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce(status(false));
    const view = render(<StudyAssistant dayIndex={0} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    session.account = { status: "signed-in", userId: "u1", email: null };
    view.rerender(<StudyAssistant dayIndex={0} />);
    await screen.findByText(INVITATION);
    await act(async () => finish(Response.json({ configured: true, signInRequired: false })));
    expect(screen.getByText(INVITATION)).toBeDefined();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("keeps local anonymous mode working without a token", async () => {
    session.account = { status: "unconfigured" };
    session.token.mockResolvedValue(null);
    fetchMock.mockResolvedValue(Response.json({ configured: true, signInRequired: false }));
    render(<StudyAssistant dayIndex={0} />);
    await screen.findByRole("textbox");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/ask", { cache: "no-store", headers: {} });
  });
});
