"use client";

import Link from "next/link";
import { eras, getWeek } from "@/content/plan";
import { phaseColor, weekAnchor, weekRangeLabel } from "@/lib/phase";
import { useCurrentEraIndex } from "@/progress/client";

export function TimelineEras() {
  const currentEra = useCurrentEraIndex();

  return (
    <ol className="m-0 list-none p-0">
      {eras.map((era, i) => {
        const color = phaseColor(getWeek(era.weeks[0]).phase);
        const here = i === currentEra;
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
  );
}
