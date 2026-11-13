import type { Metadata } from "next";
import { PlanWeeks } from "@/components/plan-weeks";
import { phases } from "@/content/plan";
import { phaseColor, weekRangeLabel } from "@/lib/phase";

export const metadata: Metadata = { title: "The full plan" };

export default function PlanPage() {
  return (
    <>
      <h1 className="m-0 text-[1.75rem] leading-tight">The full plan</h1>
      <p className="mt-1 mb-0 max-w-[65ch] text-muted">52 weeks, read in the order events happened. Sundays are for the deep dive and catching up.</p>
      {phases.map((phase) => (
        <section key={phase.id} aria-labelledby={`phase-${phase.id}`} className="mt-9">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span aria-hidden="true" className="size-3 translate-y-[-1px] rounded-[3px]" style={{ background: phaseColor(phase.id) }} />
            <h2 id={`phase-${phase.id}`} className="m-0 text-[1.375rem] leading-tight">
              {phase.name}
            </h2>
            <span className="text-sm text-muted">{weekRangeLabel(phase.weeks)}</span>
          </div>
          <PlanWeeks first={phase.weeks[0]} last={phase.weeks[1]} phaseColor={phaseColor(phase.id)} />
        </section>
      ))}
    </>
  );
}
