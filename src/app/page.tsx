import { ProgressStrip } from "@/components/progress-strip";
import { VersePractice } from "@/components/verse-practice";
import { WeekDays } from "@/components/week-days";
import { currentDay, EMPTY_PROGRESS, getPhase, getWeek, WEEK_COUNT, WEEKDAY_NAMES, type Progress } from "@/content/plan";
import { bibleGatewayUrl, estimatedMinutes } from "@/lib/reading";

export default function TodayPage() {
  return <Today progress={EMPTY_PROGRESS} />;
}

function Today({ progress }: { progress: Progress }) {
  const today = currentDay(progress.days);

  if (!today) {
    return (
      <>
        <h1 className="sr-only">Today</h1>
        <ProgressStrip progress={progress} currentWeek={null} />
        <h2 className="text-3xl">You read the whole Bible.</h2>
        <p>All 1,189 chapters in order. Review your verses, or start a second pass in a different translation.</p>
      </>
    );
  }

  const week = getWeek(today.week);
  const phase = getPhase(week.phase);
  const minutes = estimatedMinutes(today.chapters);

  return (
    <>
      <h1 className="sr-only">Today</h1>
      <ProgressStrip progress={progress} currentWeek={today.week} />

      <section aria-labelledby="reading-heading" className="mb-10">
        <h2 id="reading-heading" className="m-0 text-[clamp(2rem,8vw,2.75rem)] leading-[1.1]">
          <span className="sr-only">Today’s reading: </span>
          {today.reading}
        </h2>
        <p className="mt-2 mb-0 text-muted">
          Week {today.week} of {WEEK_COUNT}, {WEEKDAY_NAMES[today.weekday]} · {phase.name}
        </p>
        <p className="mt-1 mb-0 text-muted">
          {today.chapters} {today.chapters === 1 ? "chapter" : "chapters"} · about {minutes} minutes
        </p>
        <p className="mt-5 mb-0">
          <a className="btn btn-primary" href={bibleGatewayUrl(today.reading)} target="_blank" rel="noopener noreferrer">
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
        <WeekDays week={week} progress={progress} currentIndex={today.index} />
        <h3 className="mt-6 mb-1 text-lg">Sunday deep dive</h3>
        <p className="m-0 max-w-[65ch]">{week.deepDive}</p>
      </section>

      <VersePractice reference={week.memoryVerse.ref} text={week.memoryVerse.textKJV} />
    </>
  );
}
