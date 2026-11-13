import { WEEKDAY_NAMES, type Progress, type Week } from "@/content/plan";

export function WeekDays({ week, progress, currentIndex }: { week: Week; progress: Progress; currentIndex?: number }) {
  return (
    <ul className="m-0 list-none p-0">
      {week.days.map((day) => {
        const done = progress.days.has(day.index);
        const current = day.index === currentIndex;
        const id = `day-${day.index}`;
        return (
          <li key={day.index} className="border-t border-line first:border-t-0">
            <label htmlFor={id} className="flex min-h-11 items-center gap-3 py-1.5">
              <input id={id} type="checkbox" className="check" checked={done} disabled readOnly />
              <span className="w-10 shrink-0 text-sm text-muted">
                <abbr title={WEEKDAY_NAMES[day.weekday]} className="no-underline">
                  {day.weekday}
                </abbr>
              </span>
              <span className={current ? "font-semibold" : done ? "text-muted line-through decoration-line" : undefined}>
                {day.reading}
                {current && <span className="sr-only"> (today’s reading)</span>}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
