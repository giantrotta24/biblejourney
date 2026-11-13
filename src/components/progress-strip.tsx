"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { DAY_COUNT, phases, weeks, WEEK_COUNT } from "@/content/plan";
import { progressStats, weekState, type WeekState } from "@/lib/progress";
import { phaseColor, weekAnchor } from "@/lib/phase";
import { useCurrentWeek, useProgress } from "@/progress/client";

const SEGMENT = 10;
const HEIGHT = 64;
const TOP = 12;

const FILL: Record<WeekState, number> = { empty: 0.16, partial: 0.55, full: 1 };

function weekHref(week: number) {
  return `/plan#${weekAnchor(week)}`;
}

export function ProgressStrip() {
  const router = useRouter();
  const progress = useProgress();
  const currentWeek = useCurrentWeek();
  const { percent, daysDone, versesLearned } = progressStats(progress);
  const statsClass = progress.ready ? undefined : "invisible";

  function openWeek(event: MouseEvent<Element>, week: number) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    router.push(weekHref(week));
  }

  return (
    <section aria-labelledby="journey-heading" aria-busy={!progress.ready} className="mb-8">
      <h2 id="journey-heading" className="sr-only">
        Your journey
      </h2>
      <p className="sr-only">
        {!progress.ready
          ? "Loading your progress."
          : `${currentWeek ? `You are in week ${currentWeek} of ${WEEK_COUNT}. ` : "You have read every week. "}${percent}% of the Bible read, ${daysDone} of ${DAY_COUNT} reading days, ${versesLearned} of ${WEEK_COUNT} verses learned.`}
      </p>
      {currentWeek && (
        <a
          href={weekHref(currentWeek)}
          className="sr-only focus:not-sr-only focus:mb-2 focus:inline-block focus:text-[0.9375rem]"
        >
          Open week {currentWeek} in the plan
        </a>
      )}
      <svg viewBox={`0 0 ${WEEK_COUNT * SEGMENT} ${HEIGHT}`} className="block h-auto w-full" aria-hidden="true" focusable="false">
        {weeks.map((week) => {
          const x = (week.week - 1) * SEGMENT;
          const color = phaseColor(week.phase);
          const state = weekState(progress.days, week.week);
          return (
            <a
              key={week.week}
              href={weekHref(week.week)}
              tabIndex={-1}
              onClick={(event) => openWeek(event, week.week)}
              data-week={week.week}
              data-state={state}
            >
              <rect x={x} y={0} width={SEGMENT} height={HEIGHT} fill="transparent" />
              <rect
                x={x + 1.25}
                y={TOP}
                width={SEGMENT - 2.5}
                height={HEIGHT - TOP - 1}
                rx={2}
                fill={color}
                fillOpacity={FILL[state]}
                stroke={color}
                strokeWidth={1}
                className={week.week === currentWeek ? "current-week" : undefined}
              />
            </a>
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
      <p className="mt-5 mb-0 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[0.9375rem] text-muted" aria-hidden="true" data-testid="journey-stats">
        <span className="basis-full whitespace-nowrap sm:basis-auto">
          <span className={`font-display text-[1.75rem] leading-none text-ink tabular-nums ${statsClass ?? ""}`}>{percent}%</span> of the Bible read
        </span>
        <span className="whitespace-nowrap">
          <span className={`text-ink tabular-nums ${statsClass ?? ""}`}>{daysDone}</span> of {DAY_COUNT} days
        </span>
        <span className="whitespace-nowrap">
          <span className={`text-ink tabular-nums ${statsClass ?? ""}`}>{versesLearned}</span> of {WEEK_COUNT} verses
        </span>
      </p>
    </section>
  );
}
