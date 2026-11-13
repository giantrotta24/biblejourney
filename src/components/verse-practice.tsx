"use client";

import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
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
    <label htmlFor={id} className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-[0.9375rem]">
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
  headingLevel = 2,
}: {
  week: Week;
  label?: string;
  headingLevel?: 2 | 3;
}) {
  const [mode, setMode] = useState<Mode>("hidden");
  const Heading = `h${headingLevel}` as const;
  const { ref, textKJV } = week.memoryVerse;

  return (
    <section aria-label={label} className="rounded-2xl border border-line bg-surface p-5">
      <Heading className="m-0 text-[1.375rem] leading-tight">{ref}</Heading>
      <p className="m-0 mt-0.5 text-sm text-muted">{label}</p>
      <p aria-live="polite" className={`mt-3 mb-5 max-w-[65ch] min-h-[3.2em] ${mode === "hidden" ? "text-base text-muted italic" : "text-lg leading-relaxed"}`}>
        {mode === "hidden" ? "Say it from memory, then reveal to check." : mode === "letters" ? firstLetters(textKJV) : textKJV}
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <SegmentedControl aria-label="Show the verse as" value={mode} onValueChange={(next) => next && setMode(next)}>
          <SegmentedControlIndicator />
          {MODES.map(({ value, label: modeLabel }) => (
            <SegmentedControlItem key={value} value={value}>
              {modeLabel}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
        <KnowItToggle week={week.week} reference={ref} />
      </div>
    </section>
  );
}
