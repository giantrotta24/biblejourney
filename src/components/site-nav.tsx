"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS = [
  { href: "/", label: "Today" },
  { href: "/plan", label: "Plan" },
  { href: "/timeline", label: "Timeline" },
  { href: "/verses", label: "Verses" },
  { href: "/whos-who", label: "Who’s who" },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="-mx-1.5 mt-0.5 overflow-x-auto px-0.5 pt-1 [scrollbar-width:none] sm:-mx-3">
      <ul className="m-0 flex list-none justify-between p-0 sm:justify-start sm:gap-2">
        {SECTIONS.map(({ href, label }) => {
          const current = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center border-b-2 px-1.5 text-[0.9375rem] whitespace-nowrap no-underline transition-colors duration-150 focus-visible:outline-offset-[-2px] min-[400px]:px-2 sm:px-3 ${
                  current ? "border-lapis text-ink" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
