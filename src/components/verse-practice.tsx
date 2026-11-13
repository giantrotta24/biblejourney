"use client";

import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { useId, useState } from "react";
import type { Week } from "@/content/plan";
import { firstLetters } from "@/lib/reading";
import { setVerseLearned, useProgressReady, useVerseLearned } from "@/progress/client";

type Mode = "hidden" | "letters" | "full";

const MODES: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: "hidden", label: "Hide" },
  { value: "letters", label: "First letters" },
  { value: "full", label: "Full text" },
];

export function KnowItToggle({ week, reference }: { week: number; reference: string }) {
  const id = useId();
  const ready = useProgressReady();
  const learned = useVerseLearned(week);

  return (
    <label htmlFor={id} className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 font-sans text-sm">
      <input
        id={id}
        type="checkbox"
        className="check"
        checked={learned}
        disabled={!ready}
        onChange={(event) => void setVerseLearned(week, event.currentTarget.checked)}
      />
      I know it<span className="sr-only">: {reference}</span>
    </label>
  );
}

export function VersePractice({
  week,
  label = "This week’s memory verse",
}: {
  week: Week;
  label?: string;
}) {
  const [mode, setMode] = useState<Mode>("hidden");
  const { ref, textKJV } = week.memoryVerse;

  return (
    <section aria-label={label}>
      <h2 className="m-0 text-[1.3125rem] leading-tight">
        {ref}
      </h2>
      <p className="m-0 mt-1 font-sans text-sm text-muted">{label}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <SegmentedControl aria-label="Show the verse as" value={mode} onValueChange={(next) => next && setMode(next)}>
          {MODES.map(({ value, label: modeLabel }) => (
            <SegmentedControlItem key={value} value={value}>
              {modeLabel}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <KnowItToggle week={week.week} reference={ref} />
      </div>
      <p aria-live="polite" className={`mt-3 mb-0 max-w-[65ch] min-h-[3.2em] ${mode === "hidden" ? "text-base text-muted italic" : "text-[1.375rem] leading-[1.45] tracking-[-0.005em]"}`}>
        {mode === "hidden" ? "Say it from memory, then reveal to check." : mode === "letters" ? firstLetters(textKJV) : textKJV}
      </p>
    </section>
  );
}
