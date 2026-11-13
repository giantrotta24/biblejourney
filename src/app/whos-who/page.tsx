import type { Metadata } from "next";
import { peoples, prophets } from "@/content/plan";

export const metadata: Metadata = { title: "Who’s who" };

export default function WhosWhoPage() {
  return (
    <>
      <h1 className="m-0 text-[2rem] leading-tight">Who’s who</h1>
      <p className="mt-3.5 mb-0 max-w-[65ch] text-muted">The peoples and prophets you’ll meet, and how they relate.</p>

      <section aria-labelledby="peoples-heading" className="mt-8">
        <h2 id="peoples-heading" className="m-0 mb-2 text-[1.3125rem]">
          The peoples
        </h2>
        <dl className="m-0">
          {peoples.map((people) => (
            <div key={people.name} className="border-t border-line py-4">
              <dt className="font-display text-lg">{people.name}</dt>
              <dd className="m-0 mt-0.5 max-w-[65ch]">{people.desc}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="prophets-heading" className="mt-10">
        <h2 id="prophets-heading" className="m-0 mb-2 text-[1.3125rem]">
          The prophets in their time
        </h2>
        <ul className="m-0 list-none p-0">
          {prophets.map((prophet) => (
            <li key={prophet.name} className="border-t border-line py-4">
              <h3 className="m-0 text-lg">{prophet.name}</h3>
              <dl className="m-0 mt-1 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-sans text-sm">
                <dt className="text-muted">When</dt>
                <dd className="m-0">{prophet.when}</dd>
                <dt className="text-muted">Spoke to</dt>
                <dd className="m-0">{prophet.audience}</dd>
                <dt className="text-muted">Message</dt>
                <dd className="m-0">{prophet.message}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
