"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { University } from "@/types/api";

/** Country flag emoji from country name (covers all ten destinations). */
const FLAGS: Record<string, string> = {
  USA: "🇺🇸",
  Canada: "🇨🇦",
  "United Kingdom": "🇬🇧",
  Australia: "🇦🇺",
  Germany: "🇩🇪",
  Ireland: "🇮🇪",
  "New Zealand": "🇳🇿",
  France: "🇫🇷",
  Netherlands: "🇳🇱",
  Singapore: "🇸🇬",
};
export function flagOf(country: string): string {
  return FLAGS[country] ?? "🌍";
}

/** University logo on paper with monogram fallback. */
export function Logo({ university, size = 44 }: { university: University; size?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className="inline-flex flex-none items-center justify-center overflow-hidden rounded-xl border border-line bg-white"
      style={{ width: size, height: size }}
    >
      {failed ? (
        <span className="flex h-full w-full items-center justify-center bg-blue-wash font-serif text-sm font-bold text-blue-deep">
          {university.monogram}
        </span>
      ) : (
        <Image
          src={university.logoUrl}
          alt=""
          width={Math.round(size * 0.62)}
          height={Math.round(size * 0.62)}
          className="object-contain"
          onError={() => setFailed(true)}
          unoptimized
        />
      )}
    </span>
  );
}

/**
 * FitBlock — the ring is gone. Fit is now a serif "grade" with a thin
 * baseline meter underneath, like a mark on a report card.
 */
export function FitBlock({ score, label }: { score: number; label?: string }) {
  const pct = Math.max(Math.min(score, 100), 0);
  const tone = pct >= 72 ? "text-green" : pct >= 55 ? "text-blue-deep" : "text-amber";
  const bar = pct >= 72 ? "bg-green" : pct >= 55 ? "bg-blue" : "bg-amber";
  return (
    <div className="w-[74px] flex-none text-right" role="img" aria-label={`Fit ${Math.round(score)} out of 100`}>
      <p className={cn("font-serif text-[28px] font-bold leading-none", tone)}>
        {Math.round(score)}
        <span className="text-sm font-semibold text-ink-faint">/100</span>
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
        <div className={cn("h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
      </div>
      {label && <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{label}</p>}
    </div>
  );
}

export function admissionTone(chance: number): string {
  if (chance >= 70) return "tag-green";
  if (chance >= 45) return "tag-amber";
  return "tag-red";
}

/** Segmented pillar meters — 10 discrete cells, not a gradient bar. */
export function PillarMeter({
  scores,
  labels,
}: {
  scores: Record<string, number>;
  labels: Record<string, { label: string; icon: string }>;
}) {
  return (
    <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {Object.entries(labels).map(([key, meta]) => {
        const val = Math.round((scores[key] ?? 0) / 10);
        return (
          <div key={key}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-xs font-semibold text-ink-soft">
                {meta.icon} {meta.label}
              </span>
              <span className="font-serif text-sm font-bold">{Math.round(scores[key] ?? 0)}</span>
            </div>
            <div className="flex gap-1" role="img" aria-label={`${meta.label} ${scores[key] ?? 0} out of 100`}>
              {Array.from({ length: 10 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2 flex-1 rounded-sm",
                    i < val ? (val >= 8 ? "bg-green" : val >= 6 ? "bg-blue" : "bg-amber") : "bg-line"
                  )}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Honest budget tag — protected wording. */
export function BudgetTag({ status, note }: { status: string; note: string }) {
  if (status === "within") return <span className="tag tag-green">Fits your budget</span>;
  if (status === "stretch")
    return (
      <span className="tag tag-amber" title={note}>
        Stretch — living costs push it over budget
      </span>
    );
  return (
    <span className="tag tag-red" title={note}>
      Academically suitable, exceeds your stated budget
    </span>
  );
}

/**
 * English requirement tag — the 4-state verdict, always visible:
 * ✅ met · ⚠️ English Test Required (none provided → eligibility cannot
 * be determined) · ❌ below requirement. `detail` carries the exact
 * "IELTS required 6.5 · Your IELTS 6.0 · Short by 0.5" breakdown.
 */
export function EnglishTag({ status, detail }: { status: string; detail: string }) {
  if (status === "met")
    return (
      <span className="tag tag-green" title={detail}>
        ✓ English requirement met
      </span>
    );
  if (status === "missing")
    return (
      <span className="tag tag-amber" title={detail}>
        ⚠ English Test Required
      </span>
    );
  return (
    <span className="tag tag-red" title={detail}>
      ✗ English below requirement
    </span>
  );
}

/** Eligibility state tag for undetermined results. */
export function UndeterminedTag({ note }: { note: string }) {
  return (
    <span className="tag tag-amber" title={note}>
      ? Eligibility cannot be determined
    </span>
  );
}

export function Tag({ className, children, title }: { className?: string; children: React.ReactNode; title?: string }) {
  return (
    <span className={cn("tag tag-neutral", className)} title={title}>
      {children}
    </span>
  );
}
