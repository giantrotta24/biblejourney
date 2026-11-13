"use client";

import { memo } from "react";
import { WEEKDAY_NAMES, type Day } from "@/content/plan";
import { setDayDone, useDayDone, useIsCurrentDay, useProgressReady } from "@/progress/client";

type DayItem = Pick<Day, "index" | "weekday" | "reading"> & { week?: number };

const DayCheckbox = memo(function DayCheckbox({ day, idPrefix, withWeek }: { day: DayItem; idPrefix: string; withWeek: boolean }) {
  const ready = useProgressReady();
  const done = useDayDone(day.index);
  const current = useIsCurrentDay(day.index);
  const id = `${idPrefix}-${day.index}`;

  return (
    <li className="day-row border-b border-line last:border-b-0" data-current={current || undefined}>
      <label htmlFor={id} className="flex min-h-[52px] cursor-pointer items-center gap-3 py-1.5">
        <input
          id={id}
          type="checkbox"
          className="check"
          checked={done}
          disabled={!ready}
          onChange={(event) => void setDayDone(day.index, event.currentTarget.checked)}
        />
        <span className={`shrink-0 font-sans text-[0.8125rem] tracking-[0.04em] tabular-nums ${current ? "font-semibold text-accent" : "text-muted"} ${withWeek ? "w-[5.5rem]" : "w-11 uppercase"}`}>
          {withWeek && <>Week {day.week} </>}
          <abbr title={WEEKDAY_NAMES[day.weekday]} className="no-underline">
            {day.weekday}
          </abbr>
        </span>
        <span className={`min-w-0 font-body ${current ? "font-semibold" : done ? "text-muted" : ""}`}>
          {day.reading}
          {current && <span className="sr-only"> (today’s reading)</span>}
        </span>
      </label>
    </li>
  );
});

export function WeekDays({
  days,
  idPrefix,
  label,
  withWeek = false,
}: {
  days: readonly DayItem[];
  idPrefix: string;
  label?: string;
  withWeek?: boolean;
}) {
  return (
    <ul className="m-0 list-none p-0" aria-label={label}>
      {days.map((day) => (
        <DayCheckbox key={day.index} day={day} idPrefix={idPrefix} withWeek={withWeek} />
      ))}
    </ul>
  );
}
