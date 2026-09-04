"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Plus, Check, Rocket } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/Button";
import { AnalysisCard, Callout, DangerAlert, InsightPanel } from "@/components/ui/Panels";
import { BudgetTag, EnglishTag, FitBlock, Logo, PillarMeter, Tag, admissionTone } from "@/components/university/Bits";
import { RoadmapPanel } from "@/components/university/RoadmapPanel";
import { MediaHub } from "@/components/university/MediaHub";
import type { Roadmap } from "@/types/api";

/**
 * University profile — tabs are gone. One scrollable dossier with a
 * sticky side table-of-contents (anchor navigation), reading like a
 * counselor's report rather than an app with hidden panels.
 */

const SECTIONS = [
  ["match", "Your match"],
  ["admissions", "Admissions"],
  ["costs", "Costs & funding"],
  ["careers", "Careers"],
  ["campus", "Campus & life"],
  ["voices", "Student voices"],
] as const;

const PILLAR_LABELS = {
  academic: { label: "Admission Fit", icon: "🎓" },
  course: { label: "Course Match", icon: "📚" },
  roi: { label: "Cost & ROI", icon: "💰" },
  career: { label: "Career Outcomes", icon: "💼" },
  reputation: { label: "Reputation", icon: "🏆" },
  location: { label: "Location Fit", icon: "📍" },
  scholarship: { label: "Scholarships", icon: "🎗" },
  visa: { label: "Visa & Life", icon: "🛂" },
};

export default function UniversityPage() {
  const params = useParams<{ key: string }>();
  const key = decodeURIComponent(params.key);
  const router = useRouter();
  const { profile, compareKeys, toggleCompare, hydrated } = useProfile();
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["university", key, profile],
    queryFn: () => api.university(key, profile),
    enabled: hydrated,
  });
  const roadmapMutation = useMutation({
    mutationFn: () => api.roadmap(key, profile),
    onSuccess: setRoadmap,
  });

  if (isLoading || !hydrated) return <div className="skeleton h-[80vh]" />;
  if (isError || !data)
    return (
      <div className="panel mx-auto max-w-md p-10 text-center">
        <p className="font-serif text-2xl font-semibold">We couldn&apos;t load this university</p>
        <Button variant="primary" className="mt-5" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );

  const { result, verdict, digest } = data;
  const u = result.university;
  const selected = compareKeys.includes(u.key);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Button variant="link" onClick={() => router.back()} className="mb-4 min-h-0 px-0">
        <ArrowLeft className="h-4 w-4" /> Back to your matches
      </Button>

      {/* ---------- masthead ---------- */}
      <header className="panel p-6 sm:p-8">
        <div className="flex flex-wrap items-start gap-5">
          <Logo university={u} size={64} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-deep">
              {u.institutionType}
            </p>
            <h1 className="mt-1 font-serif text-[34px] font-semibold leading-tight tracking-tight">
              {u.name}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {u.city}, {u.country} · {u.qsRank ? `QS World Rank #${u.qsRank}` : "QS Rank: Not Available"} ·{" "}
              {u.courseName} ({u.degreeLevel})
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className={`tag ${admissionTone(result.admissionChancePercent)}`}>
                {result.admissionNote} · ~{Math.round(result.admissionChancePercent)}%
              </span>
              <EnglishTag status={result.englishStatus} detail={result.englishDetail} />
              <BudgetTag status={result.budgetStatus} note={result.budgetNote} />
              {u.internshipSupport && <Tag className="tag-green">Co-op / Internship</Tag>}
            </div>
          </div>
          <FitBlock score={result.fitScore} label={result.fitLabel} />
        </div>
        <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-5">
          <a href={u.officialUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline">
              <ExternalLink className="h-4 w-4" /> Official website
            </Button>
          </a>
          <Button variant={selected ? "primary" : "outline"} onClick={() => toggleCompare(u.key)}>
            {selected ? (
              <>
                <Check className="h-4 w-4" /> In your comparison
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Add to comparison
              </>
            )}
          </Button>
        </div>
      </header>

      {verdict.status === "ineligible" && (
        <div className="mt-4">
          <DangerAlert title="You don't currently meet this university's mandatory requirements">
            {verdict.failures.join(" · ")} — use “Enhance My Admission Chances” below for a concrete
            plan to close the gap.
          </DangerAlert>
        </div>
      )}
      {verdict.status === "undetermined" && (
        <Callout>
          <b>? Eligibility cannot be determined:</b> {verdict.missing.join(" · ")}
        </Callout>
      )}
      {verdict.status === "conditional" && <Callout>{verdict.conditions.join(" · ")}</Callout>}
      {verdict.englishStatus === "below" && verdict.status !== "ineligible" && (
        <Callout>
          <b>English check:</b> {verdict.englishDetail}
        </Callout>
      )}
      {verdict.budgetStatus === "over" && <Callout>{verdict.budgetNote}</Callout>}

      {/* ---------- body: side TOC + dossier ---------- */}
      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[3fr,9fr]">
        <nav className="top-24 hidden lg:sticky lg:block" aria-label="Sections">
          <ol className="panel space-y-0.5 p-2.5">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a
                  href={`#${id}`}
                  className="block rounded-lg px-3.5 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-blue-wash hover:text-blue-deep"
                >
                  {label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          {/* ----- your match ----- */}
          <section id="match" className="scroll-mt-24 space-y-5">
            <AnalysisCard title="Why choose this university?" foot="Written for your profile specifically — worth a careful read.">
              {data.whyChoose}
            </AnalysisCard>
            <div className="panel p-6">
              <h2 className="mb-4 font-serif text-xl font-semibold">How you match, factor by factor</h2>
              <PillarMeter scores={result.pillarScores} labels={PILLAR_LABELS} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <InsightPanel tone="green" title="Working in its favour" points={data.pros} empty="—" />
              <InsightPanel tone="amber" title="Trade-offs to weigh" points={data.cons} empty="—" />
            </div>
            <div className="panel p-6">
              <Button
                variant="primary"
                className="w-full"
                loading={roadmapMutation.isPending}
                onClick={() => (roadmap ? setRoadmap(null) : roadmapMutation.mutate())}
              >
                <Rocket className="h-4 w-4" />
                {roadmap ? "Close analysis" : "Enhance My Admission Chances"}
              </Button>
              {roadmap && <RoadmapPanel roadmap={roadmap} />}
            </div>
          </section>

          {/* ----- admissions ----- */}
          <Section id="admissions" title="Admissions">
            <FactRow label="Eligibility">{u.eligibilityCriteria}</FactRow>
            <FactRow label="Academic cutoff">~{Math.round(u.gpaRequiredPercent)}% or equivalent</FactRow>
            <FactRow label="English (any one)">
              IELTS {u.ieltsRequired} · TOEFL {u.toeflRequired} · PTE {u.pteRequired} · Duolingo {u.duolingoRequired}
            </FactRow>
            {data.ieltsEquivalent != null && (
              <p className={data.ieltsEquivalent >= u.ieltsRequired ? "text-sm font-semibold text-green" : "text-sm font-semibold text-red"}>
                {data.ieltsEquivalent >= u.ieltsRequired
                  ? `Your English level (≈ IELTS ${data.ieltsEquivalent}) meets this requirement.`
                  : `Your English level (≈ IELTS ${data.ieltsEquivalent}) is below the IELTS ${u.ieltsRequired} requirement.`}
              </p>
            )}
            <FactRow label="GRE/GMAT">{u.greGmatNote}</FactRow>
            <FactRow label="Intakes">{u.intakes.join(", ")}</FactRow>
            <FactRow label="Deadlines">{u.deadlines}</FactRow>
            <FactRow label="Acceptance rate">~{Math.round(u.acceptanceRatePercent)}% (approximate)</FactRow>
          </Section>

          {/* ----- costs ----- */}
          <Section id="costs" title="Costs & funding">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Tuition / year", result.tuitionDisplay],
                ["Living / year", result.livingDisplay],
                ["All-in / year", result.totalDisplay],
              ].map(([l, v]) => (
                <div key={l} className="well p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{l}</p>
                  <p className="mt-1 font-serif text-xl font-bold">{v}</p>
                </div>
              ))}
            </div>
            {data.budgetDisplay &&
              (result.budgetStatus === "within" ? (
                <p className="text-sm font-semibold text-green">
                  Total yearly cost fits your budget of {data.budgetDisplay}.
                </p>
              ) : (
                <Callout>{result.budgetNote}</Callout>
              ))}
            <FactRow label="Scholarships">
              {u.scholarships.length
                ? u.scholarships.join(" · ")
                : `No institution-level scholarships in our data — check government and private options for ${u.country}.`}
            </FactRow>
          </Section>

          {/* ----- careers ----- */}
          <Section id="careers" title="Careers">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Placement rate", `~${Math.round(u.placementRatePercent)}%`],
                ["Typical starting salary", `$${u.avgGradSalaryUsd.toLocaleString()}`],
                ["Co-op / internships", u.internshipSupport ? "Built in" : "Self-sourced"],
              ].map(([l, v]) => (
                <div key={l} className="well p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">{l}</p>
                  <p className="mt-1 font-serif text-xl font-bold">{v}</p>
                </div>
              ))}
            </div>
            <FactRow label="Typical recruiters">{u.topRecruiters.join(" · ")}</FactRow>
            <p className="text-xs text-ink-faint">
              Placement and salary figures are careful estimates, not audited outcomes.
            </p>
          </Section>

          {/* ----- campus ----- */}
          <Section id="campus" title="Campus & life">
            <FactRow label="Campus">{u.campusHighlight}</FactRow>
            <FactRow label="Faculty">{u.facultyHighlight}</FactRow>
            <FactRow label="Curriculum">{u.curriculumHighlight}</FactRow>
            <FactRow label="Facilities">{u.campusFacilities.join(" · ")}</FactRow>
            <FactRow label="Community">
              ~{u.studentPopulation.toLocaleString()} students, ~{Math.round(u.internationalStudentPercent)}% international
            </FactRow>
            {data.siblingCourses.length > 0 && (
              <FactRow label="Also taught here">{data.siblingCourses.join(" · ")}</FactRow>
            )}
            <a
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-deep underline-offset-4 hover:underline"
              href={`https://www.google.com/maps/search/${encodeURIComponent(`${u.name} ${u.city}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Google Maps <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </Section>

          {/* ----- voices ----- */}
          <Section id="voices" title="Student voices & media">
            <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
              <div className="well p-5">
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-lg font-semibold">{digest.sentimentLabel}</span>
                  <span className="text-xs font-semibold text-ink-faint">
                    {Math.round(digest.sentimentScore)}/100
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-green" style={{ width: `${digest.sentimentScore}%` }} />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{digest.summary}</p>
              </div>
              <div className="well p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  Reference signals analysed
                </p>
                <p className="font-serif text-3xl font-bold">~{digest.approxSignals}</p>
                <p className="mt-1 text-xs text-ink-faint">Last refreshed: {digest.refreshed}</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <InsightPanel tone="green" title="Frequently praised" points={digest.praised} empty="—" />
              <InsightPanel tone="amber" title="Common concerns" points={digest.concerns} empty="—" />
            </div>
            <p className="text-xs text-ink-faint">{digest.basisNote}</p>
            <MediaHub university={u} />
          </Section>
        </div>
      </div>
    </motion.div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-4 border-b border-line pb-2 font-serif text-2xl font-semibold">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px,1fr] sm:gap-4">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-faint sm:pt-0.5">{label}</p>
      <p className="text-sm leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}
