import type { Metadata, Viewport } from "next";
import { Literata } from "next/font/google";
import { AccountLink } from "@/components/account-link";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { SettingsLink } from "@/components/settings-link";
import { SiteNav } from "@/components/site-nav";
import { THEME_COLORS, THEME_SCRIPT } from "@/settings/settings";
import "./globals.css";

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "One-Year Bible Journey", template: "%s · One-Year Bible Journey" },
  description: "The whole Bible in a year, in the order events happened, with the history, places and people behind each reading.",
  applicationName: "Bible Journey",
  appleWebApp: { capable: true, title: "Bible Journey", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={literata.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-bg focus:px-4 focus:py-3 font-sans"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-10 bg-bg pt-[env(safe-area-inset-top)]">
          <div className="page-width">
            <div className="flex min-h-14 items-center justify-between gap-1">
              <p className="m-0 text-[0.9375rem] font-medium leading-tight">One-Year Bible Journey</p>
              <div className="-mr-3 flex shrink-0 items-center">
                <AccountLink />
                <SettingsLink />
              </div>
            </div>
            <SiteNav />
          </div>
        </header>
        <main id="main" className="page-width pt-[30px] pb-14">
          {children}
        </main>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
