"use client";

import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui-sdk/react/alert-dialog";
import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useAccount } from "@/account/session";
import { progressStore, progressSync } from "@/progress/client";
import { RESET_WORD, resetConfirmed, resetProgress } from "@/progress/reset";
import { clearSundaySeen } from "@/progress/sunday-seen";
import {
  accountReminderTime,
  changeReminderTime,
  deviceSubscription,
  disableReminders,
  enableReminders,
  pushSupported,
  remindersConfigured,
} from "@/reminders/client";
import { changeSettings, useSettings } from "@/settings/client";
import { THEMES, TRANSLATIONS, type Theme, type TranslationCode } from "@/settings/settings";

const THEME_LABELS: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };
const body = "m-0 max-w-[65ch]";
const note = "mt-2 mb-0 max-w-[65ch] text-[0.9375rem] text-muted";
const field = "min-h-11 rounded-lg border border-line bg-surface px-3 text-ink";

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="border-t border-line py-6">
      <h2 id={id} className="m-0 mb-3 text-[1.3rem] leading-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

type ReminderState = "checking" | "unsupported" | "off" | "on" | "denied";

function ReminderControls({ userId }: { userId: string }) {
  const { reminderTime } = useSettings();
  const [state, setState] = useState<ReminderState>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeId = useId();

  useEffect(() => {
    let live = true;
    (async () => {
      if (!pushSupported()) return setState("unsupported");
      try {
        const [subscription, time] = await Promise.all([deviceSubscription(), accountReminderTime(userId)]);
        if (!live) return;
        if (time) changeSettings({ reminderTime: time });
        setState(subscription && time ? "on" : "off");
      } catch {
        if (live) setState("off");
      }
    })();
    return () => {
      live = false;
    };
  }, [userId]);

  async function toggle(on: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (on) setState(await enableReminders(userId, reminderTime));
      else {
        await disableReminders(userId);
        setState("off");
      }
    } catch {
      setError("That didn’t go through. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onTime(value: string) {
    changeSettings({ reminderTime: value });
    if (state !== "on" || !value) return;
    setError(null);
    try {
      await changeReminderTime(userId, value);
    } catch {
      setError("The new time wasn’t saved. Check your connection and try again.");
    }
  }

  if (state === "unsupported") {
    return (
      <p className={body}>
        This browser can’t show reminders. On an iPhone or iPad, add the app to your Home Screen first, then open it from there.
      </p>
    );
  }

  return (
    <>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          className="check"
          checked={state === "on"}
          disabled={busy || state === "checking"}
          onChange={(event) => void toggle(event.target.checked)}
        />
        Send me a daily reminder
      </label>
      <p className="mt-3 mb-0 flex flex-wrap items-center gap-3">
        <label htmlFor={timeId}>Reminder time</label>
        <input id={timeId} type="time" required value={reminderTime} onChange={(event) => void onTime(event.target.value)} className={field} />
      </p>
      <p className={note}>One calm note a day with your next reading, sent in your own time zone.</p>
      {state === "denied" && (
        <p role="status" className="mt-3 mb-0 max-w-[65ch]">
          Notifications are turned off for this site. Allow them in your browser’s settings, then try again.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 mb-0 max-w-[65ch]">
          {error}
        </p>
      )}
    </>
  );
}

function ReminderSetting() {
  const account = useAccount();
  if (!remindersConfigured) {
    return (
      <p className={body}>
        Reminders aren’t set up on this copy of the app. Everything else works as usual, and your progress is saved on this device.
      </p>
    );
  }
  if (account.status === "loading") {
    return (
      <p aria-busy="true" className={body}>
        Checking your account…
      </p>
    );
  }
  if (account.status !== "signed-in") {
    return (
      <p className={body}>
        Reminders are sent from the server, so they need an account. <Link href="/account">Sign in</Link> to turn on a daily reminder.
      </p>
    );
  }
  return <ReminderControls userId={account.userId} />;
}

function ThemeSetting() {
  const { theme } = useSettings();
  return (
    <SegmentedControl aria-label="Theme" value={theme} onValueChange={(next) => next && changeSettings({ theme: next as Theme })}>
      <SegmentedControlIndicator />
      {THEMES.map((value) => (
        <SegmentedControlItem key={value} value={value}>
          {THEME_LABELS[value]}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

function TranslationSetting() {
  const { linkTranslation } = useSettings();
  const id = useId();
  return (
    <>
      <p className="m-0 flex flex-col gap-2">
        <label htmlFor={id}>Translation for Read online links</label>
        <select
          id={id}
          value={linkTranslation}
          onChange={(event) => changeSettings({ linkTranslation: event.target.value as TranslationCode })}
          className={`${field} max-w-md`}
        >
          {TRANSLATIONS.map(({ code, name }) => (
            <option key={code} value={code}>
              {name} ({code})
            </option>
          ))}
        </select>
      </p>
      <p className={note}>Read online opens the day’s passage on Bible Gateway in this translation.</p>
    </>
  );
}

function ResetSetting() {
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmed = resetConfirmed(typed);

  async function reset() {
    await resetProgress(progressStore(), progressSync());
    clearSundaySeen();
    setDone(true);
  }

  return (
    <>
      <p className={body}>Clear every day and memory verse you’ve marked and begin again from week 1.</p>
      <AlertDialog
        onOpenChange={(open) => {
          if (open) {
            setTyped("");
            setDone(false);
          }
        }}
      >
        <AlertDialogTrigger className="btn mt-4">Reset progress…</AlertDialogTrigger>
        <AlertDialogBackdrop className="dialog-backdrop" />
        <AlertDialogContent className="dialog" initialFocus={() => inputRef.current}>
          <AlertDialogTitle className="m-0 text-[1.3rem] leading-tight">Reset your progress?</AlertDialogTitle>
          <AlertDialogDescription className="mt-2 mb-0">
            This clears every day and memory verse you’ve marked, on this device and on your account if you’re signed in. It can’t be undone.
          </AlertDialogDescription>
          <p className="mt-4 mb-0 flex flex-col gap-2">
            <label htmlFor={inputId}>
              Type <strong>{RESET_WORD}</strong> to confirm
            </label>
            <input
              ref={inputRef}
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={field}
            />
          </p>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <AlertDialogClose className="btn">Cancel</AlertDialogClose>
            <AlertDialogClose className="btn btn-primary" value="confirm" disabled={!confirmed} action={reset}>
              Reset progress
            </AlertDialogClose>
          </div>
        </AlertDialogContent>
      </AlertDialog>
      {done && (
        <p role="status" className="mt-4 mb-0 max-w-[65ch]">
          Your progress has been reset. Week 1 is ready whenever you are.
        </p>
      )}
    </>
  );
}

export function SettingsView() {
  return (
    <>
      <p className="mt-1 mb-6 max-w-[65ch] text-muted">Make the app fit your day. Changes save as you go.</p>
      <Section title="Daily reminder">
        <ReminderSetting />
      </Section>
      <Section title="Theme">
        <ThemeSetting />
      </Section>
      <Section title="Read online">
        <TranslationSetting />
      </Section>
      <Section title="Start over">
        <ResetSetting />
      </Section>
    </>
  );
}
