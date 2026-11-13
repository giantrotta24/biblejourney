import type { Metadata } from "next";
import { PlanWeeks, type PlanWeekRow } from "@/components/plan-weeks";
import { WeekDays } from "@/components/week-days";
import { currentDay, EMPTY_PROGRESS, phases, weeks, weekDayIndexes, type Progress } from "@/content/plan";
import { phaseColor, weekAnchor, weekRangeLabel } from "@/lib/phase";

export const metadata: Metadata = { title: "The full plan" };

export default function PlanPage() {
  return <Plan progress={EMPTY_PROGRESS} />;
}

function Plan({ progress }: { progress: Progress }) {
  const today = currentDay(progress.days);
  const currentWeek = today?.week ?? null;

  return (
    <>
      <h1 className="m-0 text-[1.75rem] leading-tight">The full plan</h1>
      <p className="mt-1 mb-0 max-w-[65ch] text-muted">52 weeks, read in the order events happened. Sundays are for the deep dive and catching up.</p>
      {phases.map((phase) => {
        const rows: PlanWeekRow[] = weeks
          .filter((week) => week.phase === phase.id)
          .map((week) => {
            const dots = weekDayIndexes(week.week).map((index) => progress.days.has(index));
            return {
              week,
              dots,
              readCount: dots.filter(Boolean).length,
              current: week.week === currentWeek,
              body: (
                <>
                  <WeekDays week={week} progress={progress} currentIndex={today?.index} />
                  <p className="mt-3 mb-0 max-w-[65ch] text-[0.9375rem]">
                    <strong className="font-semibold">Sunday:</strong> {week.deepDive}
                  </p>
                  <p className="mt-2 mb-0 text-[0.9375rem] text-muted">Memory verse: {week.memoryVerse.ref}</p>
                </>
              ),
            };
          });
        const initialOpen = currentWeek && rows.some((row) => row.current) ? [weekAnchor(currentWeek)] : [];
        return (
          <section key={phase.id} aria-labelledby={`phase-${phase.id}`} className="mt-9">
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span aria-hidden="true" className="size-3 translate-y-[-1px] rounded-[3px]" style={{ background: phaseColor(phase.id) }} />
              <h2 id={`phase-${phase.id}`} className="m-0 text-[1.375rem] leading-tight">
                {phase.name}
              </h2>
              <span className="text-sm text-muted">{weekRangeLabel(phase.weeks)}</span>
            </div>
            <PlanWeeks rows={rows} phaseColor={phaseColor(phase.id)} initialOpen={initialOpen} />
          </section>
        );
      })}
    </>
  );
}
