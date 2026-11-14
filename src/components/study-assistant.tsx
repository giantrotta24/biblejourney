"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useAccount, type AccountState } from "@/account/session";
import { getAccessToken } from "@/account/supabase";
import { QUESTION_MAX_LENGTH, type AskErrorCode, type QuickPromptType } from "@/assistant/types";
import { readStream } from "@/assistant/wire";

const QUICK_PROMPTS: { type: QuickPromptType; label: string }[] = [
  { type: "history", label: "Historical setting" },
  { type: "map", label: "Where on the map" },
  { type: "people", label: "Who’s who" },
];

type ServerStatus = { configured: boolean; signInRequired: boolean; enabled?: boolean };

const INVITATION_TEXT = "The study assistant is by invitation for now.";

type Notice =
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "stopped" }
  | { kind: "signed-out" }
  | { kind: "offline" }
  | { kind: "cut-off" }
  | { kind: "refused" }
  | { kind: "truncated" }
  | { kind: "error" }
  | { kind: "server"; text: string };

const NOTICE_TEXT: Record<Exclude<Notice["kind"], "server" | "signed-out">, string> = {
  loading: "Looking into today’s reading…",
  ready: "Answer ready.",
  stopped: "Stopped. Ask again whenever you like.",
  offline: "You’re offline. The study assistant needs a connection; the rest of the app works as usual.",
  "cut-off": "The answer was cut off part way. Please try again.",
  refused: "The study assistant can’t help with that one. It answers questions about the history, places and people in today’s reading.",
  truncated: "This answer reached its length limit, so it ends part way.",
  error: "That didn’t go through. Please try again in a moment.",
};

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

function useServerStatus(online: boolean, userId: string | null): ServerStatus | "unknown" | null {
  const [status, setStatus] = useState<ServerStatus | "unknown" | null>(null);
  useEffect(() => {
    if (!online) return;
    let live = true;
    async function check() {
      const headers: Record<string, string> = {};
      if (userId) {
        const token = await getAccessToken();
        if (token) headers.authorization = `Bearer ${token}`;
      }
      const response = await fetch("/api/ask", { cache: "no-store", headers });
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<ServerStatus>;
    }
    check()
      .then((value) => live && setStatus(value))
      .catch(() => live && setStatus("unknown"));
    return () => {
      live = false;
    };
  }, [online, userId]);
  return status;
}

function NotSetUp() {
  return (
    <>
      <p className="m-0 max-w-[65ch]">The study assistant isn’t set up on this copy of the app.</p>
      <p className="mt-1 mb-0 max-w-[65ch] font-sans text-sm text-muted">Everything else works as usual.</p>
    </>
  );
}

function SignInPrompt({ expired = false }: { expired?: boolean }) {
  return (
    <p className="m-0 max-w-[65ch]">
      {expired ? "Your sign-in has expired. " : ""}
      <Link href="/account" className="inline-flex min-h-11 min-w-11 items-center underline underline-offset-4">
        Sign in
      </Link>{" "}
      to ask the study assistant about today’s reading.
    </p>
  );
}

export function StudyAssistant({ dayIndex }: { dayIndex: number }) {
  const account = useAccount();
  const identity = account.status === "signed-in" ? account.userId : account.status;
  return <AssistantPanel key={identity} dayIndex={dayIndex} account={account} />;
}

function AssistantPanel({ dayIndex, account }: { dayIndex: number; account: AccountState }) {
  const online = useOnline();
  const server = useServerStatus(online, account.status === "signed-in" ? account.userId : null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [notEnabled, setNotEnabled] = useState(false);
  const invitationRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (notEnabled) invitationRef.current?.focus({ preventScroll: true });
  }, [notEnabled]);

  const checking = server === null || (server !== "unknown" && server.signInRequired && account.status === "loading");
  const unavailable = notConfigured || (server !== "unknown" && server !== null && !server.configured);
  const needsSignIn = (server === "unknown" || server?.signInRequired === true) && account.status !== "signed-in";

  let body;
  if (!online && (checking || unavailable || needsSignIn)) {
    body = (
      <p role="status" className="m-0 max-w-[65ch]">
        {NOTICE_TEXT.offline}
      </p>
    );
  } else if (checking) {
    body = <p className="sr-only">Checking whether the study assistant is available.</p>;
  } else if (unavailable) {
    body = <NotSetUp />;
  } else if (needsSignIn) {
    body = <SignInPrompt />;
  } else if (notEnabled || (server !== "unknown" && server.enabled === false)) {
    body = <p ref={invitationRef} role="status" tabIndex={-1} className="focus-heading m-0 max-w-[65ch]">{INVITATION_TEXT}</p>;
  } else {
    body = (
      <AskForm
        dayIndex={dayIndex}
        online={online}
        signInRequired={server === "unknown" || server.signInRequired}
        onNotConfigured={() => setNotConfigured(true)}
        onNotEnabled={() => setNotEnabled(true)}
      />
    );
  }

  return (
    <section aria-labelledby="ask-heading" className="mb-10">
      <h2 id="ask-heading" className="m-0 text-[1.3125rem] leading-tight">
        Ask about this reading
      </h2>
      <p className="mt-1 mb-4 max-w-[65ch] font-sans text-sm text-muted">Get the history, geography and people behind today’s passage.</p>
      {body}
    </section>
  );
}

type AskFormProps = { dayIndex: number; online: boolean; signInRequired: boolean; onNotConfigured: () => void; onNotEnabled: () => void };

function AskForm({ dayIndex, online, signInRequired, onNotConfigured, onNotEnabled }: AskFormProps) {
  const [question, setQuestion] = useState("");
  const [raw, setRaw] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [streaming, setStreaming] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const stopButton = useRef<HTMLButtonElement>(null);
  const wasStreaming = useRef(false);

  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (streaming) {
      stopButton.current?.focus();
    } else if (wasStreaming.current) {
      const active = document.activeElement;
      if (!active || active === document.body) trigger.current?.focus();
    }
    wasStreaming.current = streaming;
  }, [streaming]);

  async function ask(body: { type: QuickPromptType } | { question: string }, from: HTMLElement | null) {
    if (controller.current) return;
    trigger.current = from;
    setRaw("");
    if (!navigator.onLine) return setNotice({ kind: "offline" });

    const abort = new AbortController();
    controller.current = abort;
    setStreaming(true);
    setNotice({ kind: "loading" });
    let received = "";

    try {
      const token = await getAccessToken();
      if (signInRequired && !token) return setNotice({ kind: "signed-out" });
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (token) headers.authorization = `Bearer ${token}`;
      const response = await fetch("/api/ask", { method: "POST", headers, body: JSON.stringify({ dayIndex, ...body }), signal: abort.signal });

      if (!response.ok || !response.body) {
        const failure = (await response.json().catch(() => null)) as { error?: string; code?: AskErrorCode } | null;
        if (response.status === 503 && failure?.code === "not_configured") return onNotConfigured();
        if (response.status === 401) return setNotice({ kind: "signed-out" });
        if (response.status === 403 && failure?.code === "not_enabled") return onNotEnabled();
        if ((response.status === 429 || response.status === 400) && failure?.error) return setNotice({ kind: "server", text: failure.error });
        return setNotice({ kind: "error" });
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value;
        setRaw(received);
      }

      const { end, text } = readStream(received);
      if (end === "complete" && !text.trim()) {
        setRaw("");
        setNotice({ kind: "error" });
      } else if (end === "complete") setNotice({ kind: "ready" });
      else if (end === "refused") {
        setRaw("");
        setNotice({ kind: "refused" });
      } else if (end === "truncated") setNotice({ kind: "truncated" });
      else setNotice({ kind: "cut-off" });
    } catch {
      if (abort.signal.aborted) setNotice({ kind: "stopped" });
      else if (!navigator.onLine) setNotice({ kind: "offline" });
      else setNotice({ kind: received ? "cut-off" : "error" });
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setStreaming(false);
      }
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (trimmed && !streaming && online) void ask({ question: trimmed }, document.activeElement instanceof HTMLElement ? document.activeElement : null);
  }

  const answer = readStream(raw).text;
  const blocked = streaming || !online;

  return (
    <>
      <div className="flex flex-wrap justify-between gap-x-3">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt.type}
            type="button"
            className="btn text-sm"
            aria-disabled={blocked || undefined}
            onClick={(event) => {
              if (!blocked) void ask({ type: prompt.type }, event.currentTarget);
            }}
          >
            {prompt.label}
          </button>
        ))}
        {streaming && (
          <button ref={stopButton} type="button" className="btn" onClick={() => controller.current?.abort()}>
            Stop
          </button>
        )}
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex max-w-xl flex-col gap-2">
        <label htmlFor="ask-question" className="font-medium">
          Or ask your own question
        </label>
        <div className="flex gap-2">
          <input
            id="ask-question"
            type="text"
            name="question"
            autoComplete="off"
            maxLength={QUESTION_MAX_LENGTH}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            aria-describedby="ask-question-count"
            className="field min-w-0 flex-1"
          />
          <button type="submit" className="btn shrink-0" aria-disabled={blocked || !question.trim() || undefined}>
            Ask
          </button>
        </div>
        <p id="ask-question-count" className="m-0 font-sans text-sm text-muted">
          {question.length} of {QUESTION_MAX_LENGTH} characters
        </p>
      </form>

      <div aria-live="polite" className="mt-4 max-w-[65ch]">
        {!online && !streaming ? (
          <p className="m-0">{NOTICE_TEXT.offline}</p>
        ) : notice &&
          (notice.kind === "signed-out" ? (
            <SignInPrompt expired />
          ) : (
            <p className={`m-0 ${notice.kind === "ready" ? "sr-only" : ""} ${notice.kind === "loading" ? "text-muted" : ""}`}>
              {notice.kind === "server" ? notice.text : NOTICE_TEXT[notice.kind]}
            </p>
          ))}
      </div>

      {answer && (
        <div aria-busy={streaming} className="mt-3 max-w-[65ch]">
          <p className="m-0 whitespace-pre-line">{answer}</p>
        </div>
      )}
    </>
  );
}
