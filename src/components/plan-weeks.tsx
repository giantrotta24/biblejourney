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
        <i key={i} className={`block h-2 w-[2px] ${on ? "bg-accent" : "bg-track"}`} />
      ))}
    </span>
  );
}

const PlanWeek = memo(function PlanWeek({ week, current }: { week: Week; current: boolean }) {
  return (
    <AccordionItem
      value={weekAnchor(week.week)}
      id={weekAnchor(week.week)}
      className="border-t border-line"
    >
      <AccordionHeader className="m-0 text-base">
        <AccordionTrigger className="flex min-h-14 w-full cursor-pointer items-center gap-2 border-0 bg-transparent py-3 text-left font-body text-ink">
          <span className="w-9 shrink-0 font-sans text-[0.8125rem] font-normal text-muted tabular-nums">Wk {week.week}</span>
          <span className={`min-w-0 flex-1 ${current ? "font-semibold" : ""}`}>
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
        <div className="pb-6">
          <WeekDays days={week.days} idPrefix="plan-day" label={`Week ${week.week} readings`} />
          <p className="mt-3 mb-0 max-w-[65ch] text-[0.9375rem]">
            <strong className="font-semibold">Sunday:</strong> {week.deepDive}
          </p>
          <p className="mt-2 mb-0 font-sans text-sm text-muted">Memory verse: {week.memoryVerse.ref}</p>
        </div>
      </AccordionPanel>
    </AccordionItem>
  );
});

export function PlanWeeks({ first, last }: { first: number; last: number }) {
  const weeks = useMemo(() => Array.from({ length: last - first + 1 }, (_, i) => getWeek(first + i)), [first, last]);
  const [accordion] = useState(() => createAccordionController());
  const firstWeek = weekAnchor(1);
  const startsPlan = first === 1;
  const [open, setOpen] = useState<string[]>(() => (startsPlan ? [firstWeek] : []));
  const [guessedFirst, setGuessedFirst] = useState(startsPlan);
  const currentWeek = useCurrentWeek();
  const [openedCurrent, setOpenedCurrent] = useState<number | null>(null);

  if (currentWeek !== openedCurrent) {
    setOpenedCurrent(currentWeek);
    const value = currentWeek && weeks.some((week) => week.week === currentWeek) ? weekAnchor(currentWeek) : null;
    const linked = weekFromHash(window.location.hash);
    const linkedToWeek = openedCurrent === null && linked !== null && weeks.some((week) => weekAnchor(week.week) === linked);
    let next = open;
    if (guessedFirst && currentWeek !== null) {
      setGuessedFirst(false);
      if (value !== firstWeek || linkedToWeek) next = next.filter((item) => item !== firstWeek || linked === firstWeek);
    }
    if (value && !linkedToWeek && !next.includes(value)) next = [...next, value];
    if (next !== open) setOpen(next);
  }

  function onValueChange(value: string[]) {
    setGuessedFirst(false);
    setOpen(value);
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
    <Accordion multiple value={open} onValueChange={onValueChange} controller={accordion}>
      {weeks.map((week) => (
        <PlanWeek key={week.week} week={week} current={week.week === currentWeek} />
      ))}
    </Accordion>
  );
}
