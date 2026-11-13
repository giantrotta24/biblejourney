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
    <li className="border-t border-line first:border-t-0">
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 py-1.5">
        <input
          id={id}
          type="checkbox"
          className="check"
          checked={done}
          disabled={!ready}
          onChange={(event) => void setDayDone(day.index, event.currentTarget.checked)}
        />
        <span className={`shrink-0 text-sm text-muted tabular-nums ${withWeek ? "w-[5.5rem]" : "w-10"}`}>
          {withWeek && <>Week {day.week} </>}
          <abbr title={WEEKDAY_NAMES[day.weekday]} className="no-underline">
            {day.weekday}
          </abbr>
        </span>
        <span className={current ? "font-semibold" : done ? "text-muted" : undefined}>
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
