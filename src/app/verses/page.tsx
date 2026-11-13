import type { Metadata } from "next";
import { VersePractice } from "@/components/verse-practice";
import { currentDay, EMPTY_PROGRESS, getWeek, WEEK_COUNT, weeks, type Progress } from "@/content/plan";

export const metadata: Metadata = { title: "Memory verses" };

export default function VersesPage() {
  return <Verses progress={EMPTY_PROGRESS} />;
}

function Verses({ progress }: { progress: Progress }) {
  const currentWeek = currentDay(progress.days)?.week ?? WEEK_COUNT;
  const thisWeek = getWeek(currentWeek);

  return (
    <>
      <h1 className="m-0 text-[1.75rem] leading-tight">Memory verses</h1>
      <p className="mt-1 mb-6 max-w-[65ch] text-muted">
        One a week, tied to what you’re reading. The text is the King James Version (public domain); learn it in whichever translation you read.
      </p>
      <VersePractice reference={thisWeek.memoryVerse.ref} text={thisWeek.memoryVerse.textKJV} />
      <h2 className="mt-10 mb-3 text-[1.375rem]">All 52 verses</h2>
      <ol className="m-0 list-none p-0">
        {weeks.map((week) => {
          const upcoming = week.week > currentWeek;
          return (
            <li key={week.week} className="border-t border-line py-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className={`m-0 text-lg ${upcoming ? "text-muted" : ""}`}>{week.memoryVerse.ref}</h3>
                <span className="shrink-0 text-sm text-muted tabular-nums">
                  Week {week.week}
                  {upcoming && <span className="sr-only">, upcoming</span>}
                </span>
              </div>
              <p className={`mt-1.5 mb-0 max-w-[65ch] text-base ${upcoming ? "text-muted" : ""}`}>{week.memoryVerse.textKJV}</p>
              {progress.verses.has(week.week) && <p className="mt-1 mb-0 text-sm text-done">Learned</p>}
            </li>
          );
        })}
      </ol>
    </>
  );
}
