"use client";

import { memo, useState } from "react";
import { getWeek, WEEK_COUNT, weeks, type Week } from "@/content/plan";
import { nextVerseWeek, unlockedWeeks } from "@/lib/progress";
import { useCurrentWeek, useProgress, useProgressReady } from "@/progress/client";
import { KnowItToggle, VersePractice } from "./verse-practice";

function useVerseWeek(): number | null {
  const ready = useProgressReady();
  const current = useCurrentWeek();
  return ready ? (current ?? WEEK_COUNT) : null;
}

export function ThisWeeksVerse() {
  const week = useVerseWeek();
  if (week === null) return <div aria-busy="true" className="min-h-56" />;
  return <VersePractice key={week} week={getWeek(week)} />;
}

export function VerseQuiz() {
  const progress = useProgress();
  const [shown, setShown] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  if (!progress.ready) return <div aria-busy="true" className="mt-11 min-h-48" />;

  const pool = unlockedWeeks(progress.days);
  const latest = pool[pool.length - 1];
  const week = getWeek(shown !== null && shown <= latest ? shown : latest);

  function next() {
    setShown(nextVerseWeek(pool, week.week));
    setRevealed(false);
  }

  return (
    <section aria-labelledby="practice-heading" className="mt-11 border-t border-line pt-6">
      <h2 id="practice-heading" className="m-0 font-sans text-sm font-normal text-muted">
        Practice · {pool.length} {pool.length === 1 ? "verse" : "verses"} unlocked
      </h2>
      <p className="mt-1 mb-0 font-display text-[1.375rem] leading-tight" aria-live="polite">
        {week.memoryVerse.ref}
      </p>
      <p className="mt-3 mb-0 flex flex-wrap gap-3">
        <button type="button" className="btn" aria-pressed={revealed} onClick={() => setRevealed(!revealed)}>
          {revealed ? "Hide" : "Reveal"}
        </button>
        <button type="button" className="btn btn-primary" onClick={next} disabled={pool.length < 2}>
          Next verse
        </button>
      </p>
      <p aria-live="polite" className={`mt-4 mb-0 max-w-[65ch] min-h-[3.2em] ${revealed ? "text-[1.375rem] leading-[1.45]" : "text-base text-muted italic"}`}>
        {revealed ? week.memoryVerse.textKJV : "Say it from memory, then reveal to check."}
      </p>
    </section>
  );
}

const VerseItem = memo(function VerseItem({ week, upcoming }: { week: Week; upcoming: boolean }) {
  return (
    <li className="border-t border-line py-4" data-upcoming={upcoming || undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={`m-0 text-lg ${upcoming ? "text-muted" : ""}`}>
          {week.memoryVerse.ref}
        </h3>
        <span className="shrink-0 font-sans text-sm text-muted tabular-nums">
          Week {week.week}
          {upcoming && <span className="sr-only">, upcoming</span>}
        </span>
      </div>
      <p className={`mt-1.5 mb-0 max-w-[65ch] text-base ${upcoming ? "text-muted" : ""}`}>{week.memoryVerse.textKJV}</p>
      <KnowItToggle week={week.week} reference={week.memoryVerse.ref} />
    </li>
  );
});

export function VerseList() {
  const through = useVerseWeek();
  return (
    <ol className="m-0 list-none p-0">
      {weeks.map((week) => (
        <VerseItem key={week.week} week={week} upcoming={through !== null && week.week > through} />
      ))}
    </ol>
  );
}
