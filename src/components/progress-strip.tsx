"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { DAY_COUNT, DAYS_PER_WEEK, getPhase, getWeek, phases, weeks, WEEK_COUNT } from "@/content/plan";
import { progressStats, weekMask, weekState } from "@/lib/progress";
import { phaseColor, weekAnchor } from "@/lib/phase";
import { useCurrentWeek, useProgress, useProgressUnsaved } from "@/progress/client";

function weekMaskCount(done: ReadonlySet<number>, week: number) {
  return weekMask(done, week).toString(2).replaceAll("0", "").length;
}

const phaseSummary = phases.map((phase) => `${phase.name}, weeks ${phase.weeks[0]}–${phase.weeks[1]}`).join("; ");

const SEGMENT = 10;
const HEIGHT = 64;
const TOP = 12;
const HIT_TOP = -14;
const HIT_BOTTOM = 12;
const BAR_INSET = 3;
const BAR_WIDTH = SEGMENT - BAR_INSET * 2;

function weekHref(week: number) {
  return `/plan#${weekAnchor(week)}`;
}

export function ProgressStrip() {
  const router = useRouter();
  const progress = useProgress();
  const currentWeek = useCurrentWeek();
  const unsaved = useProgressUnsaved();
  const { percentLabel, daysDone, versesLearned } = progressStats(progress);
  const statsClass = progress.ready ? undefined : "invisible";

  const svgRef = useRef<SVGSVGElement>(null);
  const [stop, setStop] = useState<number | null>(null);
  const [pointed, setPointed] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const active = stop ?? currentWeek ?? 1;
  const captionWeek = pointed ?? focused ?? currentWeek;

  function moveTo(week: number) {
    setStop(week);
    svgRef.current?.querySelector<SVGAElement>(`a[data-week="${week}"]`)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as Element;
    const week = Number(target.closest("a[data-week]")?.getAttribute("data-week"));
    if (!week) return;
    const next = { ArrowRight: week + 1, ArrowLeft: week - 1, Home: 1, End: WEEK_COUNT }[event.key];
    if (next !== undefined) {
      event.preventDefault();
      moveTo(Math.min(WEEK_COUNT, Math.max(1, next)));
    } else if (event.key === " ") {
      event.preventDefault();
      router.push(weekHref(week));
    }
  }

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
          : `${currentWeek ? `You are in week ${currentWeek} of ${WEEK_COUNT}. ` : "You have read every week. "}${percentLabel} of the Bible read, ${daysDone} of ${DAY_COUNT} reading days, ${versesLearned} of ${WEEK_COUNT} verses learned. Phases: ${phaseSummary}.`}
      </p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WEEK_COUNT * SEGMENT} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="block h-14 w-full touch-manipulation overflow-visible"
        role="group"
        aria-label="Weeks of the plan. Use the left and right arrow keys to move between weeks."
        onKeyDown={onKeyDown}
        onPointerLeave={() => setPointed(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(null);
        }}
      >
        {weeks.map((week) => {
          const x = (week.week - 1) * SEGMENT;
          const color = phaseColor(week.phase);
          const state = weekState(progress.days, week.week);
          return (
            <a
              key={week.week}
              href={weekHref(week.week)}
              tabIndex={week.week === active ? 0 : -1}
              aria-label={`Week ${week.week}${progress.ready ? `, ${weekMaskCount(progress.days, week.week)} of ${DAYS_PER_WEEK} days read` : ""}, ${week.title}`}
              onFocus={() => {
                setStop(week.week);
                setFocused(week.week);
              }}
              onPointerEnter={() => setPointed(week.week)}
              onPointerDown={() => setPointed(week.week)}
              onClick={(event) => openWeek(event, week.week)}
              data-week={week.week}
              data-state={state}
            >
              <rect data-part="hit" x={x} y={HIT_TOP} width={SEGMENT} height={HEIGHT - HIT_TOP + HIT_BOTTOM} fill="transparent" />
              <rect
                data-part="focus"
                x={x + 0.6}
                y={TOP - 3}
                width={SEGMENT - 1.2}
                height={HEIGHT - TOP + 5}
                rx={3}
                fill="none"
                stroke="transparent"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
              <g className={week.week === currentWeek ? "current-week" : undefined}>
                <rect
                  data-part="outline"
                  x={x + BAR_INSET}
                  y={TOP}
                  width={BAR_WIDTH}
                  height={HEIGHT - TOP - 1}
                  rx={1.5}
                  fill={state === "full" ? color : "none"}
                  stroke={color}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
                {state === "partial" && (
                  <rect
                    data-part="bar"
                    x={x + BAR_INSET}
                    y={TOP + (HEIGHT - TOP - 1) / 2}
                    width={BAR_WIDTH}
                    height={(HEIGHT - TOP - 1) / 2}
                    rx={1.5}
                    fill={color}
                  />
                )}
              </g>
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
      <p className="mt-1 mb-0 min-h-11" aria-hidden={!progress.ready || undefined}>
        {progress.ready && (
          <Link
            href={captionWeek ? weekHref(captionWeek) : "/plan"}
            className="inline-flex min-h-11 items-center py-1 text-[0.9375rem] leading-snug text-ink no-underline hover:underline"
            data-testid="strip-caption"
          >
            <span>
              {!captionWeek
                ? "All 52 weeks read · see the plan"
                : captionWeek === currentWeek
                  ? `You’re in week ${captionWeek} of ${WEEK_COUNT} · ${getPhase(getWeek(captionWeek).phase).name}`
                  : `Week ${captionWeek} of ${WEEK_COUNT} · ${getWeek(captionWeek).title}`}
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="ml-1.5 inline-block align-[-0.125em] text-muted">
                <path d="M2.5 7h9M8 3.5 11.5 7 8 10.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        )}
      </p>
      <p className="mt-1 mb-0 flex flex-wrap gap-x-4 gap-y-0.5 text-[0.9375rem] text-muted" aria-hidden="true" data-testid="journey-stats">
        <span className="whitespace-nowrap">
          <span className={`text-ink tabular-nums ${statsClass ?? ""}`}>{percentLabel}</span> read
        </span>
        <span className="whitespace-nowrap">
          <span className={`text-ink tabular-nums ${statsClass ?? ""}`}>{daysDone}</span> of {DAY_COUNT} days
        </span>
        <span className="whitespace-nowrap">
          <span className={`text-ink tabular-nums ${statsClass ?? ""}`}>{versesLearned}</span> of {WEEK_COUNT} verses
        </span>
      </p>
      <p aria-live="polite" className="mt-2 mb-0 text-[0.9375rem] text-muted">
        {unsaved && "Progress isn’t being saved on this device right now."}
      </p>
    </section>
  );
}
