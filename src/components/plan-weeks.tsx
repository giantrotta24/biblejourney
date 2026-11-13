"use client";

import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
  createAccordionController,
} from "@ui-sdk/react/accordion";
import { memo, useEffect, useMemo, useState } from "react";
import { DAYS_PER_WEEK, getWeek, type Week } from "@/content/plan";
import { weekAnchor } from "@/lib/phase";
import { useCurrentWeek, useWeekMask } from "@/progress/client";
import { WeekDays } from "./week-days";

function weekFromHash(hash: string): string | null {
  const match = /^#week-(\d{1,2})$/.exec(hash);
  return match ? `week-${match[1]}` : null;
}

function WeekDots({ week }: { week: number }) {
  const mask = useWeekMask(week);
  const dots = Array.from({ length: DAYS_PER_WEEK }, (_, i) => (mask & (1 << i)) !== 0);
  const read = dots.filter(Boolean).length;

  return (
    <span className="flex shrink-0 gap-[3px]" role="img" aria-label={`${read} of ${DAYS_PER_WEEK} days read`}>
      {dots.map((on, i) => (
        <i key={i} className={`block size-[7px] rounded-full border ${on ? "border-done bg-done" : "border-muted"}`} />
      ))}
    </span>
  );
}

const PlanWeek = memo(function PlanWeek({ week, current, phaseColor }: { week: Week; current: boolean; phaseColor: string }) {
  return (
    <AccordionItem
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
          <WeekDots week={week.week} />
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" className="shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="m2.5 4.5 3.5 3.5 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </AccordionTrigger>
      </AccordionHeader>
      <AccordionPanel>
        <div className="px-3.5 pb-4">
          <WeekDays days={week.days} idPrefix="plan-day" label={`Week ${week.week} readings`} />
          <p className="mt-3 mb-0 max-w-[65ch] text-[0.9375rem]">
            <strong className="font-semibold">Sunday:</strong> {week.deepDive}
          </p>
          <p className="mt-2 mb-0 text-[0.9375rem] text-muted">Memory verse: {week.memoryVerse.ref}</p>
        </div>
      </AccordionPanel>
    </AccordionItem>
  );
});

export function PlanWeeks({ first, last, phaseColor }: { first: number; last: number; phaseColor: string }) {
  const weeks = useMemo(() => Array.from({ length: last - first + 1 }, (_, i) => getWeek(first + i)), [first, last]);
  const [accordion] = useState(() => createAccordionController());
  const [open, setOpen] = useState<string[]>([]);
  const currentWeek = useCurrentWeek();
  const [openedCurrent, setOpenedCurrent] = useState<number | null>(null);

  if (currentWeek !== openedCurrent) {
    setOpenedCurrent(currentWeek);
    const value = currentWeek && weeks.some((week) => week.week === currentWeek) ? weekAnchor(currentWeek) : null;
    const linkedToWeek = openedCurrent === null && weekFromHash(window.location.hash) !== null;
    if (value && !linkedToWeek && !open.includes(value)) setOpen([...open, value]);
  }

  useEffect(() => {
    const values = new Set(weeks.map((week) => weekAnchor(week.week)));
    function openFromHash() {
      const value = weekFromHash(window.location.hash);
      if (!value || !values.has(value)) return;
      accordion.open(value);
      const item = document.getElementById(value);
      item?.scrollIntoView({ block: "start" });
      item?.querySelector("button")?.focus({ preventScroll: true });
    }
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [accordion, weeks]);

  return (
    <Accordion multiple value={open} onValueChange={setOpen} controller={accordion} className="flex flex-col gap-2">
      {weeks.map((week) => (
        <PlanWeek key={week.week} week={week} current={week.week === currentWeek} phaseColor={phaseColor} />
      ))}
    </Accordion>
  );
}
