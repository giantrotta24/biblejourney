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
      aria-current={current ? "page" : undefined}
      className={`flex min-h-11 min-w-11 items-center justify-center px-2 text-[0.9375rem] no-underline transition-colors duration-150 ${
        current ? "text-ink underline underline-offset-4" : "text-muted hover:text-ink"
      }`}
    >
      Account
    </Link>
  );
}
