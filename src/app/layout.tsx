import type { Metadata, Viewport } from "next";
import { Literata, Marcellus } from "next/font/google";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

const marcellus = Marcellus({
  variable: "--font-marcellus",
  weight: "400",
  subsets: ["latin"],
});

const literata = Literata({
  variable: "--font-literata",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: { default: "One-Year Bible Journey", template: "%s · One-Year Bible Journey" },
  description: "The whole Bible in a year, in the order events happened, with the history, places and people behind each reading.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1424" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${marcellus.variable} ${literata.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-10 border-b border-line bg-bg pt-[env(safe-area-inset-top)]">
          <div className="mx-auto max-w-190 px-4 pt-3">
            <p className="m-0 font-display text-lg tracking-wide">One-Year Bible Journey</p>
            <SiteNav />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-190 px-4 pt-6 pb-16">
          {children}
        </main>
      </body>
    </html>
  );
}
