"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { currentDay, getPhase, getWeek, WEEK_COUNT, WEEKDAY_NAMES, type PlanDay } from "@/content/plan";
import { catchUpDays, sundayWeek } from "@/lib/progress";
import { bibleGatewayUrl, estimatedMinutes } from "@/lib/reading";
import { setDayDone, useProgress } from "@/progress/client";
import { markSundaySeen, useSundaySeen } from "@/progress/sunday-seen";
import { VersePractice } from "./verse-practice";
import { WeekDays } from "./week-days";

const TOAST_MS = 1800;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useToast() {
  const [message, setMessage] = useState({ text: "", key: 0 });
  useEffect(() => {
    if (!message.text) return;
    const timer = window.setTimeout(() => setMessage((current) => ({ ...current, text: "" })), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [message]);
  return [message.text, (text: string) => setMessage((current) => ({ text, key: current.key + 1 }))] as const;
}

export function TodayView() {
  const progress = useProgress();
  const seen = useSundaySeen();
  const [toast, showToast] = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);

  const today = progress.ready ? currentDay(progress.days) : null;
  const sunday = progress.ready ? sundayWeek(progress.days, seen) : null;
  const view = !progress.ready ? "loading" : !today ? "finished" : sunday ? `sunday-${sunday}` : "reading";

  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    headingRef.current?.focus({ preventScroll: true });
  }, [view]);

  function markRead(day: PlanDay) {
    focusHeading.current = true;
    void setDayDone(day.index, true);
    showToast("Marked as read");
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function leaveSunday(week: number) {
    focusHeading.current = true;
    markSundaySeen(week);
  }

  return (
    <>
      {view === "loading" ? (
        <div aria-busy="true" className="min-h-[60vh]">
          <p className="sr-only">Loading your progress.</p>
        </div>
      ) : !today ? (
        <Finished headingRef={headingRef} />
      ) : sunday ? (
        <SundayView key={sunday} week={sunday} next={today} headingRef={headingRef} onContinue={() => leaveSunday(sunday)} />
      ) : (
        <ReadingView day={today} done={progress.days} headingRef={headingRef} onMarkRead={() => markRead(today)} />
      )}
      <div
        role="status"
        className={`toast pointer-events-none fixed left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink px-4.5 py-2.5 text-[0.9375rem] text-bg ${toast ? "opacity-100" : "opacity-0"}`}
      >
        {toast}
      </div>
    </>
  );
}

type HeadingRef = RefObject<HTMLHeadingElement | null>;

function ReadingView({ day, done, headingRef, onMarkRead }: { day: PlanDay; done: ReadonlySet<number>; headingRef: HeadingRef; onMarkRead: () => void }) {
  const week = getWeek(day.week);
  const phase = getPhase(week.phase);
  const minutes = estimatedMinutes(day.chapters);
  const resuming = [...done].some((index) => index > day.index);

  return (
    <>
      <section aria-labelledby="reading-heading" className="mb-10">
        {resuming && <p className="mt-0 mb-2 text-[0.9375rem] text-muted">Picking up where you left off.</p>}
        <h2 id="reading-heading" ref={headingRef} tabIndex={-1} className="m-0 text-[clamp(2rem,8vw,2.75rem)] leading-[1.1] focus:outline-none">
          <span className="sr-only">Today’s reading: </span>
          {day.reading}
        </h2>
        <p className="mt-2 mb-0 text-muted">
          Week {day.week} of {WEEK_COUNT}, {WEEKDAY_NAMES[day.weekday]} · {phase.name}
        </p>
        <p className="mt-1 mb-0 text-muted">
          {day.chapters} {day.chapters === 1 ? "chapter" : "chapters"} · about {minutes} minutes
        </p>
        <p className="mt-5 mb-0 flex flex-wrap gap-3">
          <button type="button" className="btn btn-primary" onClick={onMarkRead}>
            Mark as read
          </button>
          <a className="btn" href={bibleGatewayUrl(day.reading)} target="_blank" rel="noopener noreferrer">
            Read online<span className="sr-only"> at Bible Gateway (opens in a new tab)</span>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 2.5H2.5v9h9V9M8 2.5h3.5V6M11.5 2.5 6.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </p>
      </section>

      <section aria-labelledby="week-heading" className="mb-10">
        <h2 id="week-heading" className="m-0 text-2xl leading-tight">
          {week.title}
        </h2>
        <p className="mt-1 mb-3 text-sm text-muted">This week’s readings</p>
        <WeekDays days={week.days} idPrefix="today-day" label="This week’s readings" />
        <h3 className="mt-6 mb-1 text-lg">Sunday deep dive</h3>
        <p className="m-0 max-w-[65ch]">{week.deepDive}</p>
      </section>

      <VersePractice key={week.week} week={week} />
    </>
  );
}

function SundayView({ week: weekNumber, next, headingRef, onContinue }: { week: number; next: PlanDay; headingRef: HeadingRef; onContinue: () => void }) {
  const progress = useProgress();
  const week = getWeek(weekNumber);
  const phase = getPhase(week.phase);
  const [openDays] = useState(() => catchUpDays(progress.days, weekNumber));
  const moreWeeks = weekNumber < WEEK_COUNT;
  const nextIsNewWeek = next.week > weekNumber;

  return (
    <>
      <section aria-labelledby="sunday-heading" className="mb-10">
        <p className="mt-0 mb-1 text-muted">
          Sunday, week {weekNumber} of {WEEK_COUNT} · {phase.name}
        </p>
        <h2 id="sunday-heading" ref={headingRef} tabIndex={-1} className="m-0 text-[clamp(2rem,8vw,2.75rem)] leading-[1.1] focus:outline-none">
          <span className="sr-only">Sunday deep dive: </span>
          {week.title}
        </h2>
        <p className="mt-4 mb-0 max-w-[65ch]">{week.deepDive}</p>
        <p className="mt-5 mb-0">
          <button type="button" className="btn btn-primary" onClick={onContinue}>
            {nextIsNewWeek && moreWeeks ? `Start week ${next.week}` : "Continue reading"}
          </button>
        </p>
        <p className="mt-2 mb-0 text-sm text-muted">Next up: {next.reading}</p>
      </section>

      {openDays.length > 0 && (
        <section aria-labelledby="catch-up-heading" className="mb-10">
          <h2 id="catch-up-heading" className="m-0 text-2xl leading-tight">
            Pick up where you left off
          </h2>
          <p className="mt-1 mb-3 max-w-[65ch] text-sm text-muted">Sunday is a good day to read any of these. Tick them off as you go; there’s no rush.</p>
          <WeekDays days={openDays} idPrefix="catch-up-day" label="Readings to pick up" withWeek />
        </section>
      )}

      <VersePractice week={week} label="Verse review" />
    </>
  );
}

function Finished({ headingRef }: { headingRef: HeadingRef }) {
  return (
    <section aria-labelledby="finished-heading">
      <h2 id="finished-heading" ref={headingRef} tabIndex={-1} className="m-0 text-3xl focus:outline-none">
        You read the whole Bible.
      </h2>
      <p className="max-w-[65ch]">
        All 1,189 chapters, in the order events happened. Keep your verses fresh, or start a second pass in a different translation.
      </p>
      <p>
        <Link className="btn" href="/verses">
          Practice your verses
        </Link>
      </p>
    </section>
  );
}
