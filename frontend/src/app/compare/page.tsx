"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { downloadCsv } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/Button";
import { AnalysisCard } from "@/components/ui/Panels";
import { BudgetTag, FitBlock, Logo, Tag, admissionTone } from "@/components/university/Bits";

/** Comparison — a light editorial matrix with best-in-row marks. */
export default function ComparePage() {
  const router = useRouter();
  const { profile, compareKeys, clearCompare, hydrated } = useProfile();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["compare", compareKeys, profile],
    queryFn: () => api.compare({ ...profile, keys: compareKeys }),
    enabled: hydrated && compareKeys.length >= 2,
  });

  if (hydrated && compareKeys.length < 2) {
    return (
      <div className="panel mx-auto max-w-md p-10 text-center">
        <p className="font-serif text-2xl font-semibold">Pick at least two universities</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Tap “Compare” on two or more cards, then come back here.
        </p>
        <Link href="/results">
          <Button variant="primary" className="mt-6">
            Back to your matches
          </Button>
        </Link>
      </div>
    );
  }
  if (isLoading || !data) return <div className="skeleton h-[70vh]" />;

  const results = data.results;
  const best = results[0];

  const rows: { label: string; values: (string | number)[]; bestIdx?: number }[] = [
    {
      label: "Fit score",
      values: results.map((r) => `${Math.round(r.fitScore)}/100`),
      bestIdx: results.reduce((bi, r, i, a) => (r.fitScore > a[bi].fitScore ? i : bi), 0),
    },
    {
      label: "Admission chance",
      values: results.map((r) => `~${Math.round(r.admissionChancePercent)}%`),
      bestIdx: results.reduce((bi, r, i, a) => (r.admissionChancePercent > a[bi].admissionChancePercent ? i : bi), 0),
    },
    {
      label: "QS World Rank",
      values: results.map((r) => (r.university.qsRank ? `#${r.university.qsRank}` : "Not Available")),
      bestIdx: results.reduce((bi, r, i, a) => ((r.university.qsRank ?? 1e9) < (a[bi].university.qsRank ?? 1e9) ? i : bi), 0),
    },
    { label: "Tuition / yr", values: results.map((r) => r.tuitionDisplay) },
    { label: "Living / yr", values: results.map((r) => r.livingDisplay) },
    { label: "All-in / yr", values: results.map((r) => r.totalDisplay) },
    { label: "Duration", values: results.map((r) => `${r.university.durationYears} yrs`) },
    { label: "IELTS required", values: results.map((r) => r.university.ieltsRequired) },
    {
      label: "Placement",
      values: results.map((r) => `${Math.round(r.university.placementRatePercent)}%`),
      bestIdx: results.reduce((bi, r, i, a) => (r.university.placementRatePercent > a[bi].university.placementRatePercent ? i : bi), 0),
    },
    { label: "Co-op", values: results.map((r) => (r.university.internshipSupport ? "Yes" : "—")) },
    { label: "Scholarships", values: results.map((r) => (r.university.scholarships.length ? "Yes" : "—")) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="link" onClick={() => router.push("/results")} className="min-h-0 px-0">
          <ArrowLeft className="h-4 w-4" /> Back to your matches
        </Button>
        <Button variant="link" onClick={clearCompare} className="min-h-0 px-0 text-red">
          Clear selection
        </Button>
      </div>

      <header className="panel relative overflow-hidden p-7">
        <span className="absolute inset-y-0 left-0 w-1 bg-green" aria-hidden />
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-green">
          <Trophy className="h-4 w-4" aria-hidden /> Best overall of your selected picks
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Logo university={best.university} size={52} />
          <div className="min-w-0 flex-1">
            <h1 className="font-serif text-3xl font-semibold tracking-tight">{best.university.name}</h1>
            <p className="mt-1 text-sm text-ink-soft">
              {best.university.city}, {best.university.country} · {best.fitLabel} · {best.admissionNote}
            </p>
          </div>
          <FitBlock score={best.fitScore} />
        </div>
      </header>

      <AnalysisCard title="Why it wins among your selection">
        {best.reasons.slice(0, 4).join(" ") || "It leads on the factors weighted highest for your profile."}
      </AnalysisCard>

      <div className="overflow-x-auto panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-white/5">
              <th className="sticky left-0 bg-card p-3.5 text-left font-serif text-[15px]">Criteria</th>
              {results.map((r) => (
                <th key={r.university.key} className="p-3.5 text-left font-serif text-[15px]">
                  {r.university.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-line last:border-0">
                <td className="sticky left-0 bg-card p-3.5 text-xs font-bold uppercase tracking-wide text-ink-faint">
                  {row.label}
                </td>
                {row.values.map((v, i) => (
                  <td key={i} className={`whitespace-nowrap p-3.5 ${row.bestIdx === i ? "font-bold text-green" : "text-ink-soft"}`}>
                    {row.bestIdx === i ? "★ " : ""}
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-faint">★ = best value in that row among your selection.</p>

      <div className="grid gap-4 md:grid-cols-2">
        {results.map((r, i) => (
          <article key={r.university.key} className="panel p-5">
            <div className="flex items-center gap-3">
              <span className="font-serif text-lg font-bold text-ink-faint">{i + 1}.</span>
              <Logo university={r.university} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-serif text-lg font-semibold">{r.university.name}</p>
                <p className="truncate text-xs text-ink-faint">
                  {r.university.institutionType} · {r.university.city}
                </p>
              </div>
              <FitBlock score={r.fitScore} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className={`tag ${admissionTone(r.admissionChancePercent)}`}>
                {r.admissionNote} · ~{Math.round(r.admissionChancePercent)}%
              </span>
              <BudgetTag status={r.budgetStatus} note={r.budgetNote} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-green">Strengths for you</p>
                <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-soft">
                  {r.reasons.slice(0, 4).map((x, j) => (
                    <li key={j}>• {x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber">Points to verify</p>
                <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-soft">
                  {(r.risks.length ? r.risks : ["No major concerns found"]).slice(0, 4).map((x, j) => (
                    <li key={j}>• {x}</li>
                  ))}
                </ul>
              </div>
            </div>
            <Link href={`/university/${encodeURIComponent(r.university.key)}`}>
              <Button variant="soft" className="mt-4 w-full">
                Read the full profile
              </Button>
            </Link>
          </article>
        ))}
      </div>

      <Button
        className="w-full"
        onClick={() =>
          downloadCsv(
            "university_comparison.csv",
            results.map((r) => ({
              University: r.university.name,
              Country: r.university.country,
              City: r.university.city,
              "QS Rank": r.university.qsRank ?? "Not Available",
              "Fit Score": r.fitScore,
              "Admission Chance %": r.admissionChancePercent,
              "Tuition/yr": r.tuitionDisplay,
              "Living/yr": r.livingDisplay,
              "Placement %": r.university.placementRatePercent,
              "Co-op": r.university.internshipSupport ? "Yes" : "No",
            }))
          )
        }
      >
        <Download className="h-4 w-4" /> Download comparison (CSV)
      </Button>
    </div>
  );
}
