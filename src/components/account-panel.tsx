"use client";

import { useState, type FormEvent } from "react";
import { signInWithEmail, signInWithGoogle, signOut, useAccount, useSyncStatus } from "@/account/session";
import type { SyncStatus } from "@/sync/engine";

const SYNC_TEXT: Record<SyncStatus, string> = {
  off: "Getting ready to sync.",
  syncing: "Syncing your progress…",
  synced: "Your progress is up to date on every device you’ve signed in on.",
  offline: "You’re offline right now. Changes are saved on this device and will sync when you’re back online.",
};

const intro = "mt-1 mb-6 max-w-[65ch] text-muted";

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInWithEmail(email.trim());
      setSent(email.trim());
    } catch {
      setError("That didn’t go through. Check the address and try again.");
    } finally {
      setBusy(false);
    }
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
      {sent ? (
        <p role="status" className="m-0 max-w-[65ch]">
          Check your email at {sent} for a sign-in link. You can close this tab once you’ve opened it.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
          <label htmlFor="account-email" className="font-medium">
            Email address
          </label>
          <input
            id="account-email"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-11 rounded-lg border border-line bg-surface px-3 text-ink"
          />
          <p className="m-0">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Email me a sign-in link
            </button>
          </p>
        </form>
      )}
      <p className="mt-6 mb-0">
        <button type="button" className="btn" onClick={onGoogle}>
          Continue with Google
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

function SignedIn({ email }: { email: string | null }) {
  const status = useSyncStatus();
  const [error, setError] = useState<string | null>(null);

  async function onSignOut() {
    setError(null);
    try {
      await signOut();
    } catch {
      setError("Signing out didn’t work. Please try again.");
    }
  }

  return (
    <>
      <p className={intro}>{email ? `Signed in as ${email}.` : "You’re signed in."}</p>
      <p role="status" className="m-0 max-w-[65ch]" data-sync={status}>
        {SYNC_TEXT[status]}
      </p>
      <p className="mt-6 mb-0">
        <button type="button" className="btn" onClick={onSignOut}>
          Sign out
        </button>
      </p>
      <p className="mt-2 mb-0 text-sm text-muted">Signing out keeps your progress on this device.</p>
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
