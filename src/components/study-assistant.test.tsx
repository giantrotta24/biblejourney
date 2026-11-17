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

  it("does not take focus when the initial availability check returns disabled", async () => {
    fetchMock.mockResolvedValue(status(false));
    render(<><button type="button">Keep reading</button><StudyAssistant dayIndex={0} /></>);
    const outside = screen.getByRole("button", { name: "Keep reading" });
    outside.focus();
    const invitation = await screen.findByText(INVITATION);
    expect(document.activeElement).toBe(outside);
    expect(invitation.tagName).toBe("P");
    expect(invitation.getAttribute("role")).toBe("status");
    expect(invitation.tabIndex).toBe(-1);
    expect(invitation.classList.contains("focus-heading")).toBe(true);
  });

  it("removes the form and focuses the invitation when access is revoked after the availability check", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockResolvedValueOnce(status(true)).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<StudyAssistant dayIndex={0} />);
    const question = await screen.findByRole("textbox");
    question.focus();
    expect(document.activeElement).toBe(question);
    fireEvent.change(question, { target: { value: "Who is Abraham?" } });
    fireEvent.submit(question.closest("form")!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Stop" }));
    await act(async () => finish(Response.json({ code: "not_enabled", error: INVITATION }, { status: 403 })));
    const invitation = await screen.findByText(INVITATION);
    expect(document.activeElement).toBe(invitation);
    expect(invitation.tagName).toBe("P");
    expect(invitation.getAttribute("role")).toBe("status");
    expect(invitation.tabIndex).toBe(-1);
    expect(invitation.classList.contains("focus-heading")).toBe(true);
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

  it("announces a visible pending state while a question waits for the checked answer", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockResolvedValueOnce(status(true)).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<StudyAssistant dayIndex={0} />);
    const question = await screen.findByRole("textbox", { name: "Or ask your own question" });
    fireEvent.change(question, { target: { value: "Why a flood?" } });
    fireEvent.submit(question.closest("form")!);
    const pending = await screen.findByText(/Looking into today’s reading/);
    expect(pending.closest("[aria-live='polite']")).not.toBeNull();
    expect(pending.getAttribute("role")).toBeNull();
    expect(pending.classList.contains("sr-only")).toBe(false);
    await act(async () => finish(new Response("The flood story is about judgment.\u001Ecomplete")));
    await screen.findByText("The flood story is about judgment.");
    expect(screen.queryByRole("status", { name: /Looking into today’s reading/ })).toBeNull();
  });

  it("renders the care reply with call and text links for 988", async () => {
    const care = "I’m sorry you’re going through this. You can call 988 or text 988, the Suicide and Crisis Lifeline, in the US. If you are in danger right now, call 911 or your local emergency number. If you can, talk with your pastor or someone you trust.";
    fetchMock.mockResolvedValueOnce(status(true)).mockResolvedValueOnce(new Response(`${care}\u001Ecare`));
    render(<StudyAssistant dayIndex={1} />);
    const question = await screen.findByRole("textbox", { name: "Or ask your own question" });
    fireEvent.change(question, { target: { value: "I can't keep going" } });
    fireEvent.submit(question.closest("form")!);
    const call = await screen.findByRole("link", { name: "call 988" });
    const live = call.closest("[aria-live]");
    expect(call.getAttribute("href")).toBe("tel:988");
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.textContent).toMatch(/call 911 or your local emergency number/);
    expect(call.closest("[role='status']")).toBeNull();
    expect(screen.getByRole("link", { name: "text 988" }).getAttribute("href")).toBe("sms:988");
    expect(screen.getByText(/call 911 or your local emergency number/)).toBeTruthy();
    expect(screen.getByText(/pastor or someone you trust/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Report this answer" })).toBeNull();
  });

  it("lets a reader report an answer with an optional note", async () => {
    fetchMock
      .mockResolvedValueOnce(status(true))
      .mockResolvedValueOnce(new Response("An answer.\u001Ecomplete"))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    render(<StudyAssistant dayIndex={3} />);
    fireEvent.click(await screen.findByRole("button", { name: "Historical setting" }));
    await screen.findByText("An answer.");
    fireEvent.click(screen.getByRole("button", { name: "Report this answer" }));
    const note = screen.getByRole("textbox", { name: /note/i });
    expect(note.getAttribute("maxlength")).toBe("300");
    fireEvent.change(note, { target: { value: "This seems wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Thanks. This answer has been sent for review.");
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect(init).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer valid-token" },
    });
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      dayIndex: 3,
      kind: "history",
      answer: "An answer.",
      note: "This seems wrong",
    });
  });

  it("focuses the note when a report opens", async () => {
    fetchMock.mockResolvedValueOnce(status(true)).mockResolvedValueOnce(new Response("An answer.\u001Ecomplete"));
    render(<StudyAssistant dayIndex={3} />);
    fireEvent.click(await screen.findByRole("button", { name: "Historical setting" }));
    await screen.findByText("An answer.");
    fireEvent.click(screen.getByRole("button", { name: "Report this answer" }));
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: /note/i }));
  });

  it("closes the note on Cancel and returns focus to the report link", async () => {
    fetchMock.mockResolvedValueOnce(status(true)).mockResolvedValueOnce(new Response("An answer.\u001Ecomplete"));
    render(<StudyAssistant dayIndex={3} />);
    fireEvent.click(await screen.findByRole("button", { name: "Historical setting" }));
    await screen.findByText("An answer.");
    fireEvent.click(screen.getByRole("button", { name: "Report this answer" }));
    fireEvent.change(screen.getByRole("textbox", { name: /note/i }), { target: { value: "Wrong date" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: /note/i })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Report this answer" }));
  });

  it("focuses the thank-you line after a report is sent", async () => {
    fetchMock
      .mockResolvedValueOnce(status(true))
      .mockResolvedValueOnce(new Response("An answer.\u001Ecomplete"))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    render(<StudyAssistant dayIndex={3} />);
    fireEvent.click(await screen.findByRole("button", { name: "Historical setting" }));
    await screen.findByText("An answer.");
    fireEvent.click(screen.getByRole("button", { name: "Report this answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const thanks = await screen.findByText("Thanks. This answer has been sent for review.");
    expect(thanks.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(thanks);
  });

  it("announces a report error", async () => {
    fetchMock
      .mockResolvedValueOnce(status(true))
      .mockResolvedValueOnce(new Response("An answer.\u001Ecomplete"))
      .mockResolvedValueOnce(Response.json({ error: "You’ve sent 10 reports today. You can send more tomorrow.", code: "rate_limited" }, { status: 429 }));
    render(<StudyAssistant dayIndex={3} />);
    fireEvent.click(await screen.findByRole("button", { name: "Historical setting" }));
    await screen.findByText("An answer.");
    fireEvent.click(screen.getByRole("button", { name: "Report this answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/10 reports/);
  });

  it("sends one request when Send is clicked twice", async () => {
    let release!: (response: Response) => void;
    fetchMock
      .mockResolvedValueOnce(status(true))
      .mockResolvedValueOnce(new Response("An answer.\u001Ecomplete"))
      .mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    render(<StudyAssistant dayIndex={3} />);
    fireEvent.click(await screen.findByRole("button", { name: "Historical setting" }));
    await screen.findByText("An answer.");
    fireEvent.click(screen.getByRole("button", { name: "Report this answer" }));
    const send = screen.getByRole("button", { name: "Send" });
    fireEvent.click(send);
    fireEvent.click(send);
    await waitFor(() => expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/ask/report"))).toHaveLength(1));
    expect(send.getAttribute("aria-disabled")).toBe("true");
    await act(async () => release(Response.json({ ok: true })));
    await screen.findByText("Thanks. This answer has been sent for review.");
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/ask/report"))).toHaveLength(1);
  });

  it("includes the question when reporting an answer to one", async () => {
    fetchMock
      .mockResolvedValueOnce(status(true))
      .mockResolvedValueOnce(new Response("Because the text says so.\u001Ecomplete"))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    render(<StudyAssistant dayIndex={6} />);
    const question = await screen.findByRole("textbox", { name: "Or ask your own question" });
    fireEvent.change(question, { target: { value: "Why a flood?" } });
    fireEvent.submit(question.closest("form")!);
    await screen.findByText("Because the text says so.");
    fireEvent.click(screen.getByRole("button", { name: "Report this answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Thanks. This answer has been sent for review.");
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      dayIndex: 6,
      kind: "question",
      question: "Why a flood?",
      answer: "Because the text says so.",
    });
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
