import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { TopBar } from "@/components/chrome/TopBar";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "UniQ — find universities that genuinely fit you",
  description:
    "An eligibility-first university counselor: real admission requirements checked before anything is ranked.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <Providers>
          <TopBar />
          <main className="mx-auto min-h-[calc(100vh-140px)] w-full max-w-shell px-4 pb-20 pt-8 sm:px-6">
            {children}
          </main>
          <footer className="border-t border-line bg-black/20 backdrop-blur">
            <div className="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-2 px-6 py-5 text-xs text-ink-faint">
              <span className="font-serif text-sm font-semibold text-ink-soft">UniQ</span>
              <span>
                We estimate carefully — always confirm final figures on official university sites.
              </span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
