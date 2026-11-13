import type { Metadata } from "next";
import { ThisWeeksVerse, VerseList, VerseQuiz } from "@/components/verses-view";

export const metadata: Metadata = { title: "Memory verses" };

export default function VersesPage() {
  return (
    <>
      <h1 className="m-0 text-[1.75rem] leading-tight">Memory verses</h1>
      <p className="mt-1 mb-6 max-w-[65ch] text-muted">
        One a week, tied to what you’re reading. The text is the King James Version (public domain); learn it in whichever translation you read.
      </p>
      <ThisWeeksVerse />
      <VerseQuiz />
      <h2 className="mt-10 mb-3 text-[1.375rem]">All 52 verses</h2>
      <VerseList />
    </>
  );
}
