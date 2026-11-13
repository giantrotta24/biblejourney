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
      className={`flex min-h-11 min-w-11 items-center justify-center border-b-2 px-2 text-[0.9375rem] no-underline transition-colors duration-150 ${
        current ? "border-lapis text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      Account
    </Link>
  );
}
