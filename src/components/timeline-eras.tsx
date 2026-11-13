"use client";

import Link from "next/link";
import { eras } from "@/content/plan";
import { weekAnchor, weekRangeLabel } from "@/lib/phase";
import { useCurrentEraIndex } from "@/progress/client";

export function TimelineEras() {
  const currentEra = useCurrentEraIndex();

  return (
    <ol className="m-0 list-none p-0">
      {eras.map((era, i) => {
        const here = i === currentEra;
        const last = i === eras.length - 1;
        return (
          <li key={era.title} className="relative pb-9 pl-6" aria-current={here ? "step" : undefined}>
            {!last && <span aria-hidden="true" className="absolute top-3 -bottom-1 left-[3px] w-px bg-line" />}
            <span
              aria-hidden="true"
              className={`absolute top-2 left-0 w-[7px] ${here ? "h-4 bg-accent" : "h-[7px] bg-track"}`}
            />
            <h2 className="m-0 text-[1.3125rem] leading-tight">{era.title}</h2>
            <p className="m-0 mt-1 font-sans text-sm text-muted">{era.when}</p>
            <p className="mt-2 mb-0 flex flex-wrap gap-x-3 gap-y-1 font-sans text-[0.8125rem] text-muted">
              <span>{era.empire}</span>
              <span>{weekRangeLabel(era.weeks)}</span>
              {here && <span className="font-semibold text-ink">You are here</span>}
            </p>
            <p className="mt-2 mb-0 max-w-[65ch]">{era.summary}</p>
            <p className="mt-1.5 mb-0 font-sans text-sm text-muted">Key people: {era.keyPeople}</p>
            <p className="mt-2 mb-0">
              <Link className="btn" href={`/plan#${weekAnchor(era.weeks[0])}`}>
                Open week {era.weeks[0]} in the plan
                <span aria-hidden="true"> →</span>
              </Link>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
