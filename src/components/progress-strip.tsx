import { DAY_COUNT, days, phases, weeks, weekDayIndexes, WEEK_COUNT, type Progress } from "@/content/plan";
import { phaseColor } from "@/lib/phase";
import { percentRead } from "@/lib/reading";

const SEGMENT = 10;
const HEIGHT = 64;
const TOP = 12;

function weekFill(progress: Progress, week: number): number {
  const read = weekDayIndexes(week).filter((index) => progress.days.has(index)).length;
  if (read === 0) return 0.16;
  return read === weekDayIndexes(week).length ? 1 : 0.55;
}

export function ProgressStrip({ progress, currentWeek }: { progress: Progress; currentWeek: number | null }) {
  const percent = percentRead(progress.days, days);
  const summary = `${percent}% of the Bible read, ${progress.days.size} of ${DAY_COUNT} reading days, ${progress.verses.size} of ${WEEK_COUNT} verses learned.`;

  return (
    <section aria-labelledby="journey-heading" className="mb-8">
      <h2 id="journey-heading" className="sr-only">
        Your journey
      </h2>
      <p className="sr-only">
        {currentWeek ? `You are in week ${currentWeek} of ${WEEK_COUNT}. ` : "You have read every week. "}
        {summary}
      </p>
      <svg viewBox={`0 0 ${WEEK_COUNT * SEGMENT} ${HEIGHT}`} className="block h-auto w-full" aria-hidden="true" focusable="false">
        {weeks.map((week) => {
          const x = (week.week - 1) * SEGMENT;
          const color = phaseColor(week.phase);
          return (
            <rect
              key={week.week}
              x={x + 1.25}
              y={TOP}
              width={SEGMENT - 2.5}
              height={HEIGHT - TOP - 1}
              rx={2}
              fill={color}
              fillOpacity={weekFill(progress, week.week)}
              stroke={color}
              strokeWidth={1}
              className={week.week === currentWeek ? "current-week" : undefined}
            />
          );
        })}
        {currentWeek && (
          <path
            d={`M${(currentWeek - 1) * SEGMENT - 1} 0 H${currentWeek * SEGMENT + 1} L${(currentWeek - 0.5) * SEGMENT} 8.5 Z`}
            fill="var(--ink)"
          />
        )}
      </svg>
      <ul
        className="m-0 mt-2 grid list-none gap-x-[0.4%] p-0 text-[0.8125rem] leading-snug text-muted"
        style={{ gridTemplateColumns: phases.map((p) => `${p.weeks[1] - p.weeks[0] + 1}fr`).join(" ") }}
        aria-hidden="true"
      >
        {phases.map((phase) => (
          <li key={phase.id} className="border-t-2 pt-1.5" style={{ borderColor: phaseColor(phase.id) }}>
            <span className="block text-ink tabular-nums">
              {phase.weeks[0]}–{phase.weeks[1]}
            </span>
            <span className="hidden pr-2 sm:block">{phase.name}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5 mb-0 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[0.9375rem] text-muted" aria-hidden="true">
        <span className="basis-full whitespace-nowrap sm:basis-auto">
          <span className="font-display text-[1.75rem] leading-none text-ink tabular-nums">{percent}%</span> of the Bible read
        </span>
        <span className="whitespace-nowrap">
          <span className="text-ink tabular-nums">{progress.days.size}</span> of {DAY_COUNT} days
        </span>
        <span className="whitespace-nowrap">
          <span className="text-ink tabular-nums">{progress.verses.size}</span> of {WEEK_COUNT} verses
        </span>
      </p>
    </section>
  );
}
