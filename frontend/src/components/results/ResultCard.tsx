"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Check, Sparkles, FileCheck, Send } from "lucide-react";
import { motion } from "framer-motion";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/Button";
import { SopFlow } from "@/components/sop/SopFlow";
import { VerifyFlow } from "@/components/verify/VerifyFlow";
import { ApplyFlow } from "@/components/apply/ApplyFlow";
import { BudgetTag, EnglishTag, FitBlock, Logo, Tag, UndeterminedTag, admissionTone, flagOf } from "@/components/university/Bits";
import type { RankedResult } from "@/types/api";

/**
 * Result card — glass panel with hover elevation + glow, colored status
 * rail, serif grade block, country flag, pull-quote headline. The rail
 * and tags surface the 4-state eligibility verdict at a glance.
 */
export function ResultCard({ rank, result }: { rank: number; result: RankedResult }) {
  const { compareKeys, toggleCompare, profile } = useProfile();
  const u = result.university;
  const selected = compareKeys.includes(u.key);
  // SOP overlay is gated by a local flag; SopFlow portals itself to
  // document.body, so it escapes this card's .panel containing block and
  // renders as a true fullscreen overlay without a route change.
  const [sopOpen, setSopOpen] = useState(false);
  // VerifyFlow follows the same portal pattern — opened from the SOP result's
  // "Continue application" action or directly from the card later.
  const [verifyOpen, setVerifyOpen] = useState(false);
  // ApplyFlow (Agent 4) — the Apply Now surface. Opens the live automation
  // overlay; it runs its own readiness gate and routes the student to
  // verification when documents are not yet verified.
  const [applyOpen, setApplyOpen] = useState(false);
  // Set when VerifyFlow hands off a passed verification — lets ApplyFlow skip
  // its name gate and pre-open the readiness check.
  const [applyName, setApplyName] = useState<string | undefined>(undefined);
  const [applyVerified, setApplyVerified] = useState(false);
  const rail =
    result.eligibilityStatus === "conditional" || result.eligibilityStatus === "undetermined"
      ? "bg-amber"
      : "bg-green";

  return (
    <article className="panel panel-hover relative mb-4 overflow-hidden pl-1.5">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${rail}`} aria-hidden />
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="mt-1 font-serif text-lg font-bold text-ink-faint">{rank}.</span>
          <Logo university={u} />
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-xl font-semibold leading-snug">
              <Link
                href={`/university/${encodeURIComponent(u.key)}`}
                className="hover:text-blue-deep hover:underline underline-offset-4"
              >
                {u.name}
              </Link>
            </h3>
            <p className="mt-0.5 text-[13px] text-ink-faint">
              <span aria-hidden>{flagOf(u.country)}</span> {u.city}, {u.country} ·{" "}
              {u.institutionType} · {u.degreeLevel} · {u.courseName}
            </p>
          </div>
          <FitBlock score={result.fitScore} label={result.fitLabel} />
        </div>

        <blockquote className="mt-4 border-l-2 border-blue pl-4 font-serif text-[15px] italic leading-relaxed text-ink-soft">
          {result.headline}
        </blockquote>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className={`tag ${admissionTone(result.admissionChancePercent)}`}>
            {result.admissionNote} · ~{Math.round(result.admissionChancePercent)}%
          </span>
          <EnglishTag status={result.englishStatus} detail={result.englishDetail} />
          {result.eligibilityStatus === "undetermined" && (
            <UndeterminedTag note={result.conditionalNote} />
          )}
          {result.eligibilityStatus === "conditional" && (
            <Tag className="tag-amber" title={result.conditionalNote}>
              Conditional / pathway route
            </Tag>
          )}
          <BudgetTag status={result.budgetStatus} note={result.budgetNote} />
          {u.qsRank && <Tag className="tag-blue">QS #{u.qsRank}</Tag>}
          {u.internshipSupport && <Tag className="tag-green">Co-op / Internship</Tag>}
        </div>
        {result.englishStatus !== "met" && (
          <p className="mt-2.5 rounded-lg border border-amber/25 bg-amber-wash px-3.5 py-2 text-xs leading-relaxed text-amber">
            {result.englishDetail}
          </p>
        )}

        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-line pt-4 text-sm">
          {[
            ["Tuition", `${result.tuitionDisplay}/yr`],
            ["Living", `${result.livingDisplay}/yr`],
            ["Duration", `${u.durationYears} yrs`],
            ["Placement", `${Math.round(u.placementRatePercent)}%`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link href={`/university/${encodeURIComponent(u.key)}`}>
            <Button variant="soft">Read the full profile</Button>
          </Link>
          <Button
            variant={selected ? "primary" : "outline"}
            onClick={() => toggleCompare(u.key)}
            aria-pressed={selected}
          >
            {selected ? (
              <>
                <Check className="h-4 w-4" /> In your comparison
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Compare
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => setSopOpen(true)}>
            <Sparkles className="h-4 w-4" /> Generate SOP
          </Button>
          <Button variant="outline" onClick={() => setVerifyOpen(true)}>
            <FileCheck className="h-4 w-4" /> Verify documents
          </Button>
          {/* Apply Now is always visible. It opens the automation overlay whose
              readiness gate enables smooth submission once verification passes. */}
          <motion.span whileTap={{ scale: 0.97 }} className="inline-flex rounded-full">
            <Button
              variant="primary"
              onClick={() => {
                setApplyName(undefined);
                setApplyVerified(false);
                setApplyOpen(true);
              }}
            >
              <Send className="h-4 w-4" /> Apply now
            </Button>
          </motion.span>
        </div>
        {sopOpen && (
          <SopFlow
            university={u}
            profile={profile}
            onClose={() => setSopOpen(false)}
            onContinueApplication={() => {
              setSopOpen(false);
              setVerifyOpen(true);
            }}
          />
        )}
        {verifyOpen && (
          <VerifyFlow
            university={u}
            profile={profile}
            onClose={() => setVerifyOpen(false)}
            onContinueApply={(fullName) => {
              setVerifyOpen(false);
              setApplyName(fullName);
              setApplyVerified(true);
              setApplyOpen(true);
            }}
          />
        )}
        {applyOpen && (
          <ApplyFlow
            university={u}
            profile={profile}
            fullName={applyName}
            verified={applyVerified}
            onClose={() => setApplyOpen(false)}
          />
        )}
      </div>
    </article>
  );
}
