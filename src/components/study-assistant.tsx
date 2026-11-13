"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useAccount } from "@/account/session";
import { getAccessToken } from "@/account/supabase";
import { QUESTION_MAX_LENGTH, type AskErrorCode, type QuickPromptType } from "@/assistant/types";

const QUICK_PROMPTS: { type: QuickPromptType; label: string }[] = [
  { type: "history", label: "Historical setting" },
  { type: "map", label: "Where on the map" },
  { type: "people", label: "Who’s who" },
];

type ServerStatus = { configured: boolean; signInRequired: boolean };

type Notice =
  | { kind: "loading" }
  | { kind: "stopped" }
  | { kind: "signed-out" }
  | { kind: "offline" }
  | { kind: "cut-off" }
  | { kind: "error" }
  | { kind: "server"; text: string };

const NOTICE_TEXT: Record<Exclude<Notice["kind"], "server" | "signed-out">, string> = {
  loading: "Looking into today’s reading…",
  stopped: "Stopped. Ask again whenever you like.",
  offline: "You’re offline. The study assistant needs a connection; the rest of the app works as usual.",
  "cut-off": "The answer was cut off part way. Please try again.",
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

function useServerStatus(online: boolean): ServerStatus | "unknown" | null {
  const [status, setStatus] = useState<ServerStatus | "unknown" | null>(null);
  useEffect(() => {
    if (!online) return;
    let live = true;
    fetch("/api/ask", { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<ServerStatus>) : Promise.reject(new Error(String(response.status)))))
      .then((value) => live && setStatus(value))
      .catch(() => live && setStatus("unknown"));
    return () => {
      live = false;
    };
  }, [online]);
  return status;
}

function NotSetUp() {
  return (
    <>
      <p className="m-0 max-w-[65ch]">The study assistant isn’t set up on this copy of the app.</p>
      <p className="mt-1 mb-0 max-w-[65ch] text-sm text-muted">Everything else works as usual.</p>
    </>
  );
}

function SignInPrompt({ expired = false }: { expired?: boolean }) {
  return (
    <p className="m-0 max-w-[65ch]">
      {expired ? "Your sign-in has expired. " : ""}
      <Link href="/account" className="underline underline-offset-4">
        Sign in
      </Link>{" "}
      to ask the study assistant about today’s reading.
    </p>
  );
}

export function StudyAssistant({ dayIndex }: { dayIndex: number }) {
  const online = useOnline();
  const server = useServerStatus(online);
  const account = useAccount();
  const [notConfigured, setNotConfigured] = useState(false);

  let body;
  if (!online) {
    body = (
      <p role="status" className="m-0 max-w-[65ch]">
        {NOTICE_TEXT.offline}
      </p>
    );
  } else if (server === null || (server !== "unknown" && server.signInRequired && account.status === "loading")) {
    body = <p className="sr-only">Checking whether the study assistant is available.</p>;
  } else if (notConfigured || (server !== "unknown" && !server.configured)) {
    body = <NotSetUp />;
  } else if ((server === "unknown" || server.signInRequired) && account.status !== "signed-in") {
    body = <SignInPrompt />;
  } else {
    body = <AskForm dayIndex={dayIndex} signInRequired={server === "unknown" || server.signInRequired} onNotConfigured={() => setNotConfigured(true)} />;
  }

  return (
    <section aria-labelledby="ask-heading" className="mb-10">
      <h2 id="ask-heading" className="m-0 text-2xl leading-tight">
        Ask about this reading
      </h2>
      <p className="mt-1 mb-4 max-w-[65ch] text-sm text-muted">Get the history, geography and people behind today’s passage.</p>
      {body}
    </section>
  );
}

function AskForm({ dayIndex, signInRequired, onNotConfigured }: { dayIndex: number; signInRequired: boolean; onNotConfigured: () => void }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [streaming, setStreaming] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function ask(body: { type: QuickPromptType } | { question: string }) {
    controller.current?.abort();
    setAnswer("");
    if (!navigator.onLine) return setNotice({ kind: "offline" });

    const abort = new AbortController();
    controller.current = abort;
    setStreaming(true);
    setNotice({ kind: "loading" });
    let received = false;

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
        if ((response.status === 429 || response.status === 400) && failure?.error) return setNotice({ kind: "server", text: failure.error });
        return setNotice({ kind: "error" });
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!received) setNotice(null);
        received = true;
        setAnswer((current) => current + value);
      }
      setNotice(null);
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
    if (trimmed) void ask({ question: trimmed });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button key={prompt.type} type="button" className="btn" disabled={streaming} onClick={() => void ask({ type: prompt.type })}>
            {prompt.label}
          </button>
        ))}
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
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-ink"
          />
          <button type="submit" className="btn btn-primary" disabled={streaming || !question.trim()}>
            Ask
          </button>
        </div>
        <p id="ask-question-count" className="m-0 text-sm text-muted">
          {question.length} of {QUESTION_MAX_LENGTH} characters
        </p>
      </form>

      <div aria-live="polite" aria-busy={streaming} className="mt-4 max-w-[65ch]">
        {notice &&
          (notice.kind === "signed-out" ? (
            <SignInPrompt expired />
          ) : (
            <p className={`m-0 ${notice.kind === "loading" ? "text-muted" : ""}`}>{notice.kind === "server" ? notice.text : NOTICE_TEXT[notice.kind]}</p>
          ))}
        {answer && <p className={`m-0 whitespace-pre-line ${notice ? "mt-3" : ""}`}>{answer}</p>}
      </div>

      {streaming && (
        <p className="mt-3 mb-0">
          <button type="button" className="btn" onClick={() => controller.current?.abort()}>
            Stop
          </button>
        </p>
      )}
    </>
  );
}
