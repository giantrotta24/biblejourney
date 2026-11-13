"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { syncThemeColor } from "@/settings/client";

export function SettingsLink() {
  const current = usePathname() === "/settings";

  useEffect(() => {
    syncThemeColor();
  }, []);

  return (
    <Link
      href="/settings"
      aria-current={current ? "page" : undefined}
      aria-label="Settings"
      title="Settings"
      className={`flex min-h-11 min-w-11 items-center justify-center border-b-2 transition-colors duration-150 ${current ? "border-lapis text-ink" : "border-transparent text-muted hover:text-ink"}`}
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M3 5.5h8M15 5.5h2M3 14.5h2M9 14.5h8" />
        <circle cx="13" cy="5.5" r="2" />
        <circle cx="7" cy="14.5" r="2" />
      </svg>
    </Link>
  );
}
