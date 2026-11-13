"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { startAccounts } from "@/account/session";

export function AccountLink() {
  const current = usePathname() === "/account";

  useEffect(() => {
    startAccounts();
  }, []);

  return (
    <Link
      href="/account"
      aria-label="Account"
      title="Account"
      aria-current={current ? "page" : undefined}
      className={`flex min-h-11 min-w-11 items-center justify-center border-b-2 no-underline transition-colors duration-150 ${
        current ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      <svg aria-hidden="true" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8.5" r="3.75" />
        <path d="M4.75 20c.9-3.6 3.8-5.5 7.25-5.5s6.35 1.9 7.25 5.5" />
      </svg>
    </Link>
  );
}
