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
    <nav aria-label="Sections" className="-mx-2 mt-1 overflow-x-auto">
      <ul className="m-0 flex list-none justify-between p-0 sm:justify-start sm:gap-2">
        {SECTIONS.map(({ href, label }) => {
          const current = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 items-center border-b-2 px-2 text-[0.9375rem] whitespace-nowrap no-underline transition-colors duration-150 sm:px-3 ${
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
