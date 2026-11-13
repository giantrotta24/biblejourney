"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { DAY_COUNT, DAYS_PER_WEEK, getPhase, getWeek, phases, weeks, WEEK_COUNT } from "@/content/plan";
import { progressStats, weekMask, weekState } from "@/lib/progress";
import { weekAnchor } from "@/lib/phase";
import { useCurrentWeek, useProgress, useProgressUnsaved } from "@/progress/client";

function weekMaskCount(done: ReadonlySet<number>, week: number) {
  return weekMask(done, week).toString(2).replaceAll("0", "").length;
}

const phaseSummary = phases.map((phase) => `${phase.name}, weeks ${phase.weeks[0]}–${phase.weeks[1]}`).join("; ");

const WIDTH = 342;
const HEIGHT = 18;
const PHASE_GAP = 5;
const STEP = (WIDTH - 3 - (phases.length - 1) * PHASE_GAP) / (WEEK_COUNT - 1);

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
  const [selected, setSelected] = useState<number | null>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const pointerInside = useRef(false);
  const active = stop ?? currentWeek ?? 1;
  const captionWeek = selected ?? currentWeek;

  function select(week: number) {
    setSelected(week);
  }

  function onRegionPointerLeave(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;
    pointerInside.current = false;
    if (!regionRef.current?.contains(document.activeElement)) setSelected(null);
  }

  function onRegionBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    if (!pointerInside.current) setSelected(null);
  }

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
    <section aria-labelledby="journey-heading" aria-busy={!progress.ready} className="-mt-[13px] mb-10 font-sans">
      <h2 id="journey-heading" className="sr-only">
        Your journey
      </h2>
      <p className="sr-only">
        {!progress.ready
          ? "Loading your progress."
          : `${currentWeek ? `You are in week ${currentWeek} of ${WEEK_COUNT}. ` : "You have read every week. "}${percentLabel} of the Bible read, ${daysDone} of ${DAY_COUNT} reading days, ${versesLearned} of ${WEEK_COUNT} verses learned. Phases: ${phaseSummary}.`}
      </p>
      <div
        ref={regionRef}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") pointerInside.current = true;
        }}
        onPointerLeave={onRegionPointerLeave}
        onBlur={onRegionBlur}
      >
      <svg
        ref={svgRef}
        viewBox={`0 -13 ${WIDTH} 44`}
        preserveAspectRatio="none"
        className="block h-11 w-full touch-manipulation overflow-visible"
        role="group"
        aria-label="Weeks of the plan. Use the left and right arrow keys to move between weeks."
        onKeyDown={onKeyDown}
      >
        {weeks.map((week) => {
          const x = 1.5 + (week.week - 1) * STEP + phases.filter((phase) => phase.weeks[1] < week.week).length * PHASE_GAP;
          const state = weekState(progress.days, week.week);
          const current = week.week === currentWeek;
          const height = current ? HEIGHT : 8;
          const top = (HEIGHT - height) / 2;
          const width = current || state !== "empty" ? 3 : 1.5;
          const color = current || state !== "empty" ? "var(--accent)" : "var(--track)";
          return (
            <a
              key={week.week}
              href={weekHref(week.week)}
              tabIndex={week.week === active ? 0 : -1}
              aria-label={`Week ${week.week}${progress.ready ? `, ${weekMaskCount(progress.days, week.week)} of ${DAYS_PER_WEEK} days read` : ""}, ${week.title}`}
              onFocus={() => {
                setStop(week.week);
                select(week.week);
              }}
              onPointerEnter={(event) => event.pointerType !== "touch" && select(week.week)}
              onPointerDown={() => select(week.week)}
              onClick={(event) => openWeek(event, week.week)}
              data-week={week.week}
              data-state={state}
            >
              <rect data-part="hit" x={x - STEP / 2} y={-13} width={STEP} height={44} fill="transparent" />
              <rect
                data-part="focus"
                x={x - STEP / 2}
                y={-3}
                width={STEP}
                height={24}
                rx={1}
                fill="none"
                stroke="transparent"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
              <g className={current ? "current-week" : undefined} data-part={current ? "marker" : undefined}>
                <rect
                  data-part="outline"
                  x={x - width / 2}
                  y={top}
                  width={width}
                  height={state === "partial" ? (height - 3) / 2 : height}
                  rx={width / 2}
                  fill={color}
                />
                {state === "partial" && (
                  <rect
                    data-part="bar"
                    x={x - width / 2}
                    y={top + (height + 3) / 2}
                    width={width}
                    height={(height - 3) / 2}
                    rx={width / 2}
                    fill={color}
                  />
                )}
              </g>
            </a>
          );
        })}
      </svg>
      <p className="mt-0.5 mb-0 min-h-11" aria-hidden={!progress.ready || undefined}>
        {progress.ready && (
          <Link
            href={captionWeek ? weekHref(captionWeek) : "/plan"}
            className="inline-flex min-h-11 items-start text-[0.8125rem] leading-snug tracking-[0.01em] text-muted no-underline hover:underline"
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
      </div>
      <p className="m-0 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.8125rem] text-muted" aria-hidden="true" data-testid="journey-stats">
        <span className="whitespace-nowrap">
          <span className={`tabular-nums ${statsClass ?? ""}`}>{percentLabel}</span> read
        </span>
        <span className="whitespace-nowrap">
          <span className={`tabular-nums ${statsClass ?? ""}`}>{daysDone}</span> of {DAY_COUNT} days
        </span>
        <span className="whitespace-nowrap">
          <span className={`tabular-nums ${statsClass ?? ""}`}>{versesLearned}</span> of {WEEK_COUNT} verses
        </span>
      </p>
      <p aria-live="polite" className={`${unsaved ? "mt-2" : "mt-0"} mb-0 text-[0.9375rem] text-muted`}>
        {unsaved && "Progress isn’t being saved on this device right now."}
      </p>
    </section>
  );
}
