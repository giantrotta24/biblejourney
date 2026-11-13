import type { Metadata } from "next";
import { TimelineEras } from "@/components/timeline-eras";

export const metadata: Metadata = { title: "The story in time" };

export default function TimelinePage() {
  return (
    <>
      <h1 className="m-0 text-[2rem] leading-tight">The story in time</h1>
      <p className="mt-3.5 mb-8 max-w-[65ch] text-muted">
        Each era, the empire in charge, and the weeks you’ll read it. Dates are approximate; early ones are debated.
      </p>
      <TimelineEras />
    </>
  );
}
