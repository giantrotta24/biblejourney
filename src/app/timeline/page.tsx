import type { Metadata } from "next";
import Link from "next/link";
import { currentDay, EMPTY_PROGRESS, eras, getWeek, type Progress } from "@/content/plan";
import { phaseColor, weekAnchor, weekRangeLabel } from "@/lib/phase";

export const metadata: Metadata = { title: "The story in time" };

export default function TimelinePage() {
  return <Timeline progress={EMPTY_PROGRESS} />;
}

function Timeline({ progress }: { progress: Progress }) {
  const currentWeek = currentDay(progress.days)?.week ?? null;

  return (
    <>
      <h1 className="m-0 text-[1.75rem] leading-tight">The story in time</h1>
      <p className="mt-1 mb-8 max-w-[65ch] text-muted">
        Each era, the empire in charge, and the weeks you’ll read it. Dates are approximate; early ones are debated.
      </p>
      <ol className="m-0 list-none p-0">
        {eras.map((era, i) => {
          const color = phaseColor(getWeek(era.weeks[0]).phase);
          const here = currentWeek !== null && currentWeek >= era.weeks[0] && currentWeek <= era.weeks[1];
          const last = i === eras.length - 1;
          return (
            <li key={era.title} className="relative pb-8 pl-8" aria-current={here ? "step" : undefined}>
              {!last && <span aria-hidden="true" className="absolute top-3 -bottom-1 left-[6px] w-0.5 bg-line" />}
              <span
                aria-hidden="true"
                className="absolute top-2 left-0 size-3.5 rounded-full border-[3px] border-bg"
                style={{ background: color, boxShadow: here ? `0 0 0 3px ${color}` : undefined }}
              />
              <h2 className="m-0 text-[1.375rem] leading-tight">{era.title}</h2>
              <p className="m-0 mt-0.5 text-[0.9375rem] text-muted">{era.when}</p>
              <p className="mt-2 mb-0 flex flex-wrap gap-1.5 text-[0.8125rem]">
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5">{era.empire}</span>
                <span className="rounded-full bg-surface-2 px-2.5 py-0.5">{weekRangeLabel(era.weeks)}</span>
                {here && <span className="rounded-full bg-ink px-2.5 py-0.5 text-bg">You are here</span>}
              </p>
              <p className="mt-2 mb-0 max-w-[65ch]">{era.summary}</p>
              <p className="mt-1.5 mb-0 text-[0.9375rem] text-muted">Key people: {era.keyPeople}</p>
              <p className="mt-2 mb-0">
                <Link className="inline-flex min-h-11 items-center text-[0.9375rem]" href={`/plan#${weekAnchor(era.weeks[0])}`}>
                  Open week {era.weeks[0]} in the plan
                </Link>
              </p>
            </li>
          );
        })}
      </ol>
    </>
  );
}
