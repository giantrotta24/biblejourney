"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const SECTIONS = [
  { href: "/", label: "Today" },
  { href: "/plan", label: "Plan" },
  { href: "/timeline", label: "Timeline" },
  { href: "/verses", label: "Verses" },
  { href: "/whos-who", label: "Who’s who" },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [more, setMore] = useState<"none" | "start" | "end" | "both">("none");

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () => {
      const before = nav.scrollLeft > 1;
      const after = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1;
      setMore(before && after ? "both" : before ? "start" : after ? "end" : "none");
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    if (nav.firstElementChild) observer.observe(nav.firstElementChild);
    nav.addEventListener("scroll", update, { passive: true });
    return () => {
      observer.disconnect();
      nav.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <nav ref={navRef} aria-label="Sections" data-more={more} className="site-nav -mx-1.5 mt-0.5 overflow-x-auto px-0.5 pt-1 sm:-mx-3">
      <ul className="m-0 flex w-max min-w-full list-none justify-between p-0 sm:justify-start sm:gap-2">
        {SECTIONS.map(({ href, label }) => {
          const current = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })}
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
