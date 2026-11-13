"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { emailSignInError, signInWithEmail, signInWithGoogle, signOut, useAccount, useRejectedChanges, useSyncStatus, verifyEmailCode } from "@/account/session";
import type { SyncStatus } from "@/sync/engine";

const SYNC_TEXT: Record<SyncStatus, string> = {
  off: "Getting ready to sync.",
  syncing: "Syncing your progress…",
  synced: "Your progress is up to date on every device you’ve signed in on.",
  offline: "You’re offline right now. Changes are saved on this device and will sync when you’re back online.",
};

const intro = "mt-1 mb-6 max-w-[65ch] text-muted";
const wrapAnywhere = "[overflow-wrap:anywhere]";
export const ACCOUNT_HEADING_ID = "account-heading";

function NotSetUp() {
  return (
    <>
      <p className={intro}>Accounts aren’t set up on this copy of the app.</p>
      <p className="m-0 max-w-[65ch]">
        Your progress is saved on this device, and everything works without signing in. Keep reading; nothing is lost.
      </p>
    </>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"sending" | "verifying" | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const returningToEmail = useRef(false);

  useEffect(() => {
    if (sent) codeRef.current?.focus({ preventScroll: true });
    else if (returningToEmail.current) {
      emailRef.current?.focus({ preventScroll: true });
      returningToEmail.current = false;
    }
  }, [sent]);

  async function sendCode() {
    if (busy) return;
    const address = sent ?? email.trim();
    setBusy("sending");
    setMessage(null);
    setError(null);
    try {
      await signInWithEmail(address);
      setSent(address);
      setCode("");
      if (sent) {
        setMessage("A new code is on its way.");
        codeRef.current?.focus({ preventScroll: true });
      }
    } catch (error) {
      const failure = emailSignInError(error, navigator.onLine);
      setMessage(failure.message);
      if (failure.kind === "rate-limit") setSent(address);
    } finally {
      setBusy(null);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!sent) return sendCode();
    setMessage(null);
    setError(null);
    if (!/^[0-9]{6,10}$/.test(code)) {
      setMessage("Enter the 6–10 digit code from your email.");
      codeRef.current?.focus({ preventScroll: true });
      return;
    }
    setBusy("verifying");
    try {
      await verifyEmailCode(sent, code);
    } catch (error) {
      setMessage(emailSignInError(error, navigator.onLine).message);
      codeRef.current?.focus({ preventScroll: true });
      codeRef.current?.select();
    } finally {
      setBusy(null);
    }
  }

  function onDifferentEmail() {
    if (busy) return;
    returningToEmail.current = true;
    setEmail(sent ?? email);
    setSent(null);
    setCode("");
    setMessage(null);
    setError(null);
  }

  async function onGoogle() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setError("Google sign-in didn’t start. Please try again.");
    }
  }

  return (
    <>
      <p className={intro}>
        Sign in to keep your progress in step on your phone and laptop. Anything you’ve already marked on this device comes with you.
      </p>
      <p className={intro}>
        In your phone’s home-screen app, enter the code here because the email link opens in your browser.
      </p>
      <p id="account-sign-in-status" role="status" tabIndex={-1} className={`m-0 max-w-[65ch] ${wrapAnywhere} ${sent || message ? "mb-4" : "sr-only"}`}>
        {sent && `Check your email at ${sent} for a sign-in code.`}
        {message && `${sent ? " " : ""}${message}`}
      </p>
      <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
        {sent ? (
          <>
            <label htmlFor="account-code" className="font-medium">Email code</label>
            <input
              ref={codeRef}
              id="account-code"
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              required
              readOnly={Boolean(busy)}
              aria-describedby="account-sign-in-status"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\s/g, ""))}
              className="field"
            />
          </>
        ) : (
          <>
            <label htmlFor="account-email" className="font-medium">Email address</label>
            <input
              ref={emailRef}
              id="account-email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              required
              readOnly={Boolean(busy)}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field"
            />
          </>
        )}
        <p className="m-0">
          <button type="submit" className="btn btn-primary" disabled={Boolean(busy)} aria-busy={busy === "verifying" || (!sent && busy === "sending") || undefined}>
            {sent ? (busy === "verifying" ? "Signing in…" : "Sign in") : (busy === "sending" ? "Sending a code…" : "Email me a code")}
          </button>
        </p>
        {sent && (
          <>
            <p className="m-0">
              <button type="button" className="btn" onClick={sendCode} disabled={Boolean(busy)} aria-busy={busy === "sending" || undefined}>
                Send a new code
              </button>
            </p>
            <p className="m-0">
              <button type="button" className="btn" onClick={onDifferentEmail} disabled={Boolean(busy)}>
                Use a different email
              </button>
            </p>
          </>
        )}
      </form>
      <p className="mt-6 mb-0">
        <button type="button" className="btn" onClick={onGoogle} disabled={Boolean(busy)}>
          Continue with Google
          <span aria-hidden="true"> →</span>
        </button>
      </p>
      {error && (
        <p role="alert" className="mt-4 mb-0">
          {error}
        </p>
      )}
    </>
  );
}

function rejectedText(count: number): string | null {
  if (count <= 0) return null;
  return `${count === 1 ? "1 change" : `${count} changes`} could not be synced.`;
}

function SignedIn({ email }: { email: string | null }) {
  const status = useSyncStatus();
  const rejected = rejectedText(useRejectedChanges());
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    setError(null);
    try {
      await signOut();
      document.getElementById(ACCOUNT_HEADING_ID)?.focus({ preventScroll: true });
    } catch {
      setError("Signing out didn’t work. Please try again.");
    }
  }

  return (
    <>
      <p className={`${intro} ${wrapAnywhere}`}>{email ? `Signed in as ${email}.` : "You’re signed in."}</p>
      <p role="status" className="m-0 max-w-[65ch] text-ink" data-sync={status}>
        {rejected && status !== "syncing" ? rejected : SYNC_TEXT[status]}
      </p>
      <p className="mt-6 mb-0">
        <button type="button" className="btn" onClick={onSignOut}>
          Sign out
        </button>
      </p>
      <p className="mt-2 mb-0 font-sans text-sm text-muted">Signing out keeps your progress on this device.</p>
      {error && (
        <p role="alert" className="mt-4 mb-0">
          {error}
        </p>
      )}
    </>
  );
}

export function AccountPanel() {
  const account = useAccount();
  switch (account.status) {
    case "unconfigured":
      return <NotSetUp />;
    case "loading":
      return (
        <p aria-busy="true" className={intro}>
          Checking your account…
        </p>
      );
    case "signed-out":
      return <SignIn />;
    case "signed-in":
      return <SignedIn email={account.email} />;
  }
}
