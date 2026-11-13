"use client";

import { SegmentedControl, SegmentedControlIndicator, SegmentedControlItem } from "@ui-sdk/react/segmented-control";
import { useState } from "react";
import { firstLetters } from "@/lib/reading";

type Mode = "hidden" | "letters" | "full";

const MODES: ReadonlyArray<{ value: Mode; label: string }> = [
  { value: "hidden", label: "Hide" },
  { value: "letters", label: "First letters" },
  { value: "full", label: "Full text" },
];

export function VersePractice({ reference, text, headingLevel = 2 }: { reference: string; text: string; headingLevel?: 2 | 3 }) {
  const [mode, setMode] = useState<Mode>("hidden");
  const Heading = `h${headingLevel}` as const;

  return (
    <section aria-label="This week’s memory verse" className="rounded-2xl border border-line bg-surface p-5">
      <p className="m-0 text-sm text-muted">This week’s memory verse</p>
      <Heading className="m-0 mt-1 text-[1.375rem] leading-tight">{reference}</Heading>
      <p aria-live="polite" className={`mt-3 mb-5 max-w-[65ch] min-h-[3.2em] ${mode === "hidden" ? "text-base text-muted italic" : "text-lg leading-relaxed"}`}>
        {mode === "hidden" ? "Say it from memory, then reveal to check." : mode === "letters" ? firstLetters(text) : text}
      </p>
      <SegmentedControl aria-label="Show the verse as" value={mode} onValueChange={(next) => next && setMode(next)}>
        <SegmentedControlIndicator />
        {MODES.map(({ value, label }) => (
          <SegmentedControlItem key={value} value={value}>
            {label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </section>
  );
}
