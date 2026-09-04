"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Download, PencilLine, Scale, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { downloadCsv, movementTone } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/Button";
import { AnalysisCard, Callout, DangerAlert, Hint } from "@/components/ui/Panels";
import { ResultCard } from "@/components/results/ResultCard";
import { SearchSelect } from "@/components/ui/SearchSelect";
import type { RerankEntry } from "@/types/api";

const SORTS = ["Overall fit (recommended)", "Lowest total cost", "Admission chance", "QS rank"];

/**
 * Results — restructured: a sticky profile-summary sidebar on the left
 * (see & edit what drives the ranking), the ranked list on the right,
 * and a floating compare tray that slides up as universities are picked.
 */
export default function ResultsPage() {
  const router = useRouter();
  const { profile, update, compareKeys, toggleCompare, clearCompare, hydrated } = useProfile();
  const [sort, setSort] = useState(SORTS[0]);
  const [rerankEntries, setRerankEntries] = useState<RerankEntry[] | null>(null);
  const [rerankError, setRerankError] = useState<string | null>(null);

  // Fix: always open this page from the very top (browser scroll
  // restoration otherwise lands mid-page after navigation).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const ready = hydrated && Boolean(profile.targetCourse);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["search", profile],
    queryFn: () => api.search(profile),
    enabled: ready,
  });

  const rerank = useMutation({
    mutationFn: () =>
      api.rerank({
        ...profile,
        rankedKeys: (data?.ranked ?? []).slice(0, 10).map((r) => r.university.key),
      }),
    onSuccess: (res) => {
      setRerankError(null);
      setRerankEntries(res.entries);
      // The results render in the main column — take the student there.
      setTimeout(() => {
        document.getElementById("rerank-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    },
    onError: () => {
      setRerankEntries(null);
      setRerankError(
        "The re-ranking service didn't respond. Make sure the backend window is running, then try again."
      );
    },
  });

  const ordered = useMemo(() => {
    const ranked = data?.ranked ?? [];
    if (sort === "Lowest total cost")
      return [...ranked].sort((a, b) => a.university.totalCostUsdPerYear - b.university.totalCostUsdPerYear);
    if (sort === "Admission chance")
      return [...ranked].sort((a, b) => b.admissionChancePercent - a.admissionChancePercent);
    if (sort === "QS rank")
      return [...ranked].sort((a, b) => (a.university.qsRank ?? 9999) - (b.university.qsRank ?? 9999));
    return ranked;
  }, [data, sort]);

  const selectedResults = useMemo(
    () => (data?.ranked ?? []).filter((r) => compareKeys.includes(r.university.key)),
    [data, compareKeys]
  );

  if (hydrated && !profile.targetCourse) {
    return (
      <div className="panel mx-auto max-w-md p-10 text-center">
        <p className="font-serif text-2xl font-semibold">Let&apos;s start with your details</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          We need your course, budget and scores before we can match universities.
        </p>
        <Link href="/">
          <Button variant="primary" className="mt-6">
            Tell us about yourself
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading || !hydrated) {
    return (
      <div className="grid gap-8 lg:grid-cols-[4fr,8fr]">
        <div className="skeleton h-72" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-48" />
          ))}
          <p className="text-center text-sm text-ink-faint">
            Checking requirements and ranking your matches…
          </p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="panel mx-auto max-w-md p-10 text-center">
        <p className="font-serif text-2xl font-semibold">That didn&apos;t work — but nothing was lost</p>
        <p className="mt-2 text-sm text-ink-soft">
          The recommendation service didn&apos;t respond. Make sure the backend is running, then try again.
        </p>
        <Button variant="primary" className="mt-6" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const { ranked, excluded, budgetCheck } = data;
  const top = ranked[0];

  const profileFacts: [string, string][] = [
    ["Course", `${profile.targetCourse} · ${profile.degreeLevel}`],
    ["Intake", profile.intakeSession],
    ["Budget", profile.budgetText],
    ["Score", `${profile.gradingValue} (${profile.gradingSystem})`],
    ["Destinations", profile.preferredCountries.join(", ") || "All ten countries"],
    ...(profile.preferredCity ? ([["City", profile.preferredCity]] as [string, string][]) : []),
  ];

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[4fr,8fr]">
      {/* ---------- sticky profile sidebar ---------- */}
      <aside className="space-y-4 lg:sticky lg:top-24">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Your profile</h2>
            <Link href="/">
              <Button variant="link" className="min-h-0 px-0 py-0 text-xs">
                <PencilLine className="h-3.5 w-3.5" /> Edit
              </Button>
            </Link>
          </div>
          <dl className="mt-3 space-y-2.5">
            {profileFacts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-line pb-2 text-sm last:border-0">
                <dt className="flex-none font-semibold text-ink-faint">{k}</dt>
                <dd className="text-right text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="panel p-5">
          <h3 className="font-serif text-lg font-semibold">Reading your list</h3>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              [String(data.nEligible), "eligible"],
              [String(data.nConditional + data.nUndetermined), "to verify"],
              [String(excluded.length), "excluded"],
            ].map(([n, label]) => (
              <div key={label} className="well p-3">
                <dt className="sr-only">{label}</dt>
                <dd className="font-serif text-2xl font-bold">{n}</dd>
                <dd className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-ink-faint">
            Requirements are checked before anything is ranked — excluded universities receive no score.
          </p>
        </section>

        <section className="panel p-5">
          <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-blue" aria-hidden /> AI Re-Ranking
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
            A counselor&apos;s second look at your top ten — your notes, unmet requirements and
            shortlist balance reorder the list, with the reason for every move.
          </p>
          <Button
            variant="primary"
            className="mt-3 w-full"
            loading={rerank.isPending}
            onClick={() => rerank.mutate()}
          >
            Run AI Re-Ranking
          </Button>
          {rerankError && (
            <p className="mt-2 rounded-lg bg-red-wash px-3 py-2 text-xs font-medium text-red">
              {rerankError}
            </p>
          )}
        </section>
      </aside>

      {/* ---------- main column ---------- */}
      <div className="space-y-5 pb-24">
        {data.nUndetermined > 0 && (
        <Callout>
          <b>⚠ English Test Required:</b> {data.nUndetermined} of your matches require proof of
          English proficiency (IELTS / TOEFL / PTE / Duolingo). Until you add a score,
          their eligibility cannot be determined and they are ranked cautiously — {" "}
          <Link href="/" className="font-semibold underline underline-offset-2">
            add your English test
          </Link>{" "}
          to unlock accurate results.
        </Callout>
      )}
      {budgetCheck.level === "unrealistic" && (
          <DangerAlert title="Your budget looks too low for this selection">
            {budgetCheck.message}
          </DangerAlert>
        )}
        {budgetCheck.level === "tight" && <Callout>{budgetCheck.message}</Callout>}
        {data.fallbackAll && (
          <Callout>
            Nothing matched your course name specifically — showing the full database instead.
          </Callout>
        )}
        {data.allowBroader && <Hint>Broader search active — country, city and degree filters are relaxed.</Hint>}

        {ranked.length === 0 ? (
          <>
            <DangerAlert title="No universities currently eligible">
              Your profile doesn&apos;t currently meet the mandatory requirements at any of the{" "}
              {excluded.length} universities matching your filters. Improving your English score is
              usually the fastest unlock — each university&apos;s specific gap is listed below.
            </DangerAlert>
            <ul className="space-y-2">
              {excluded.slice(0, 15).map((e) => (
                <li key={e.university.key} className="panel flex items-start gap-3 p-4">
                  <span className="tag tag-red flex-none">Not eligible</span>
                  <div>
                    <p className="text-sm font-semibold">
                      {e.university.name}{" "}
                      <span className="font-normal text-ink-faint">
                        ({e.university.city}, {e.university.country})
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-ink-soft">{e.failures.join(" · ")}</p>
                  </div>
                </li>
              ))}
            </ul>
            {!data.allowBroader && (
              <Button variant="primary" className="w-full" onClick={() => update({ allowBroader: true })}>
                Search more broadly (relax country, city and degree filters)
              </Button>
            )}
          </>
        ) : (
          <>
            <AnalysisCard
              title="Your review, in brief"
              foot="Requirements were checked before ranking. Figures are careful estimates — confirm final details on each university's official site."
            >
              After the mandatory eligibility check, <b>{ranked.length}</b> of{" "}
              <b>{ranked.length + excluded.length}</b> matching programs remain.{" "}
              <b>{top.university.name}</b> leads with a fit score of <b>{Math.round(top.fitScore)}/100</b>.
              {data.nWithinBudget === 0 && (
                <>
                  {" "}
                  <b>None of these fit your stated budget</b> — the cheapest ({data.cheapestName})
                  costs about <b>{data.budgetFloorDisplay}/yr</b> all-in. The cards below are
                  labelled honestly, not presented as budget matches.
                </>
              )}
            </AnalysisCard>

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="font-serif text-3xl font-semibold tracking-tight">
                  {ranked.length} universities worth your attention
                </h1>
                <p className="mt-1 text-sm text-ink-soft">
                  Matched to your course, destination and level — ordered by overall fit.
                </p>
              </div>
              <SearchSelect
                value={sort}
                onChange={setSort}
                options={SORTS}
                placeholder="Sort by"
                ariaLabel="Sort results"
                searchable={false}
                compact
                className="w-64"
              />
            </div>

            <AnimatePresence>
              {ordered.map((r, i) => (
                <motion.div
                  key={r.university.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.24) }}
                >
                  <ResultCard rank={i + 1} result={r} />
                </motion.div>
              ))}
            </AnimatePresence>

            {rerankEntries && (
              <section className="panel p-6">
                <h3 id="rerank-results" className="scroll-mt-24 font-serif text-xl font-semibold">
                  AI Re-Ranking — a counselor&apos;s second look
                </h3>
                <ol className="mt-3 space-y-2">
                  {rerankEntries.map((e) => (
                    <li key={e.name} className="flex items-start gap-3 well p-3.5">
                      <span className={`w-10 flex-none font-serif text-sm font-bold ${movementTone(e.movement)}`}>
                        {e.movement}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">
                          #{e.newRank} · {e.name}{" "}
                          <span className="font-normal text-ink-faint">(was #{e.oldRank})</span>
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{e.reason}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {excluded.length > 0 && (
              <details className="panel p-5">
                <summary className="cursor-pointer font-serif text-lg font-semibold">
                  Not currently eligible ({excluded.length}) — see what&apos;s blocking each
                </summary>
                <ul className="mt-4 space-y-2.5">
                  {excluded.map((e) => (
                    <li key={e.university.key} className="flex items-start gap-3 border-b border-line pb-2.5 last:border-0">
                      <span className="tag tag-red flex-none">Not eligible</span>
                      <div>
                        <p className="text-sm font-semibold">{e.university.name}</p>
                        <p className="mt-0.5 text-xs text-ink-soft">{e.failures.join(" · ")}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <Button
              className="w-full"
              onClick={() =>
                downloadCsv(
                  "university_shortlist.csv",
                  ordered.map((r, i) => ({
                    Rank: i + 1,
                    University: r.university.name,
                    Country: r.university.country,
                    City: r.university.city,
                    "QS Rank": r.university.qsRank ?? "Not Available",
                    "Fit Score": r.fitScore,
                    "Admission Chance %": r.admissionChancePercent,
                    Eligibility: r.eligibilityStatus,
                    "Budget status": r.budgetNote || r.budgetStatus,
                    "Tuition/yr": r.tuitionDisplay,
                    "Living/yr": r.livingDisplay,
                  }))
                )
              }
            >
              <Download className="h-4 w-4" /> Download shortlist (CSV)
            </Button>
          </>
        )}
      </div>

      {/* ---------- floating compare tray ---------- */}
      <AnimatePresence>
        {compareKeys.length > 0 && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-x-0 bottom-0 z-30"
          >
            <div className="mx-auto mb-4 flex max-w-shell items-center gap-3 rounded-2xl border border-line bg-card/90 backdrop-blur-xl px-5 py-3.5 shadow-tray sm:mx-auto sm:w-fit">
              <Scale className="h-5 w-5 flex-none text-blue" aria-hidden />
              <div className="flex flex-wrap items-center gap-1.5">
                {selectedResults.map((r) => (
                  <button
                    key={r.university.key}
                    onClick={() => toggleCompare(r.university.key)}
                    className="tag tag-blue group"
                    title="Remove from comparison"
                  >
                    {r.university.name.length > 26
                      ? r.university.name.slice(0, 24) + "…"
                      : r.university.name}
                    <X className="h-3 w-3 opacity-60 group-hover:opacity-100" aria-hidden />
                  </button>
                ))}
              </div>
              <Button variant="link" className="min-h-0 flex-none px-1 py-0 text-xs" onClick={clearCompare}>
                Clear
              </Button>
              <Button
                variant="primary"
                className="min-h-0 flex-none px-4 py-2"
                disabled={compareKeys.length < 2}
                onClick={() => router.push("/compare")}
              >
                Compare {compareKeys.length >= 2 ? `(${compareKeys.length})` : "— pick 2+"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
