"use client";

import { GraduationCap, RotateCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/hooks/useProfile";

/**
 * Persistent product chrome — the app finally has a home. A quiet white
 * bar with the wordmark, a live journey indicator (Profile → Matches →
 * Compare) that doubles as navigation, and Start over.
 */
export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, reset, compareKeys } = useProfile();
  const hasProfile = Boolean(profile.targetCourse);

  const steps = [
    { href: "/", label: "Profile", enabled: true, active: pathname === "/" },
    {
      href: "/results",
      label: "Matches",
      enabled: hasProfile,
      active: pathname.startsWith("/results") || pathname.startsWith("/university"),
    },
    {
      href: "/compare",
      label: `Compare${compareKeys.length ? ` · ${compareKeys.length}` : ""}`,
      enabled: compareKeys.length >= 2,
      active: pathname.startsWith("/compare"),
    },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grad-primary flex h-9 w-9 items-center justify-center rounded-xl text-white">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-serif text-xl font-semibold tracking-tight">
            Uni<span className="grad-text">Q</span>
          </span>
        </Link>

        <nav aria-label="Your journey" className="hidden items-center gap-1 sm:flex">
          {steps.map((s, i) => (
            <span key={s.label} className="flex items-center">
              {i > 0 && <span className="mx-1 h-px w-5 bg-line-strong" aria-hidden />}
              {s.enabled ? (
                <Link
                  href={s.href}
                  aria-current={s.active ? "step" : undefined}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                    s.active ? "bg-blue-wash text-blue-deep" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {i + 1}. {s.label}
                </Link>
              ) : (
                <span className="cursor-not-allowed rounded-full px-3.5 py-1.5 text-sm font-semibold text-ink-faint">
                  {i + 1}. {s.label}
                </span>
              )}
            </span>
          ))}
        </nav>

        <button
          onClick={() => {
            reset();
            router.push("/");
          }}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-red"
          title="Clears everything and begins a fresh search."
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Start over
        </button>
      </div>
    </header>
  );
}
