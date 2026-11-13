"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  createAccordionController,
} from "@ui-sdk/react/accordion";
import { useEffect, useState, type ReactNode } from "react";
import type { Week } from "@/content/plan";
import { weekAnchor } from "@/lib/phase";

export type PlanWeekRow = { week: Week; readCount: number; dots: boolean[]; current: boolean; body: ReactNode };

function weekFromHash(hash: string): string | null {
  const match = /^#week-(\d{1,2})$/.exec(hash);
  return match ? `week-${match[1]}` : null;
}

export function PlanWeeks({ rows, phaseColor, initialOpen }: { rows: PlanWeekRow[]; phaseColor: string; initialOpen: string[] }) {
  const [accordion] = useState(() => createAccordionController());
  const [open, setOpen] = useState(initialOpen);

  useEffect(() => {
    const values = new Set(rows.map((row) => weekAnchor(row.week.week)));
    function openFromHash() {
      const value = weekFromHash(window.location.hash);
      if (!value || !values.has(value)) return;
      accordion.open(value);
      document.getElementById(value)?.scrollIntoView({ block: "start" });
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [accordion, rows]);

  return (
    <Accordion multiple value={open} onValueChange={setOpen} controller={accordion} className="flex flex-col gap-2">
      {rows.map(({ week, readCount, dots, current, body }) => (
        <AccordionItem
          key={week.week}
          value={weekAnchor(week.week)}
          id={weekAnchor(week.week)}
          className="rounded-xl border bg-surface"
          style={{ borderColor: current ? phaseColor : "var(--line)" }}
        >
          <AccordionHeader className="m-0 font-body text-base">
            <AccordionTrigger className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent px-3.5 py-2.5 text-left text-ink">
              <span className="w-12 shrink-0 font-display text-[0.9375rem] text-muted tabular-nums">Wk {week.week}</span>
              <span className="min-w-0 flex-1">
                {week.title}
                {current && <span className="sr-only"> (current week)</span>}
              </span>
              <span className="flex shrink-0 gap-[3px]" role="img" aria-label={`${readCount} of ${dots.length} days read`}>
                {dots.map((on, i) => (
                  <i key={i} className={`block size-[7px] rounded-full border ${on ? "border-done bg-done" : "border-muted"}`} />
                ))}
              </span>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" className="shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="m2.5 4.5 3.5 3.5 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </AccordionTrigger>
          </AccordionHeader>
          <AccordionPanel>
            <div className="px-3.5 pb-4">{body}</div>
          </AccordionPanel>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
