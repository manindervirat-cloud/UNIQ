"use client";

/**
 * VerifyFlow — the in-app Document Verification stage.
 *
 * This is NOT a route and NOT a separate tool. It is a fixed full-viewport
 * overlay rendered on top of the results page, opened from the SOP stage's
 * "Continue application" action (or directly from a result card). It reuses
 * every piece of profile data already collected (name, grades, English scores,
 * target course, the selected university) and only asks for the documents
 * themselves — then runs the embedded verification pipeline and shows the
 * readiness report inline. The student never feels they left the platform.
 *
 * Journey position: University Agent -> SOP Agent -> Document Verification.
 * Same overlay pattern, same design system, same motion language as SopFlow.
 *
 * Flow: load catalogue -> pick university (pre-selected from the SOP stage) +
 * confirm name once -> document checklist with per-slot upload -> run pipeline
 * -> structured report (per-document status + overall application readiness).
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  FileUp,
  FileWarning,
  MinusCircle,
  Send,
  ShieldCheck,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { buildApplicantRecord, buildStudentId } from "@/lib/verify";
import { AnalysisCard, Callout, DangerAlert, Hint } from "@/components/ui/Panels";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import type { StudentPayload, University } from "@/types/api";
import type {
  VerifyReport,
  VerifyRequiredDocument,
  VerifyUniversity,
} from "@/types/verify";

const NAME_KEY = "study-abroad-student-name-v1";
const ACCEPT = ".png,.jpg,.jpeg,.pdf,.webp,.bmp,.tiff";

type Phase = "loading" | "intake" | "verifying" | "report";

export function VerifyFlow({
  university,
  profile,
  onClose,
  onContinueApply,
}: {
  /** The university carried over from the SOP stage, when there is one. */
  university: University | null;
  profile: StudentPayload;
  onClose: () => void;
  /** When provided, a VERIFIED report offers "Continue to Apply", handing the
      confirmed name to the Application Automation (Agent 4) overlay. */
  onContinueApply?: (fullName: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [catalogue, setCatalogue] = useState<VerifyUniversity[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [report, setReport] = useState<VerifyReport | null>(null);
  const [error, setError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  // ── load the university/document catalogue once ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const unis = await api.verifyUniversities();
        if (cancelled) return;
        setCatalogue(unis);

        // Try to match the university from SOP with the catalogue
        if (university) {
          const match = unis.find(
            (v) => v.name.toLowerCase() === university.name.toLowerCase()
          );

          if (match) {
            // Exact match found - use its document checklist
            setSelectedId(match.id);
          } else {
            // No match - create a generic entry for this university
            // Use a common document set that works for most applications
            const genericEntry: VerifyUniversity = {
              id: "generic-" + university.key,
              name: university.name,
              country: university.country,
              location: `${university.city}, ${university.country}`,
              registry_name: "Standard Document Verification",
              required_documents: [
                { doc_type: "tenth_marksheet", label: "10th Grade Marksheet" },
                { doc_type: "twelfth_marksheet", label: "12th Grade Marksheet" },
                { doc_type: "bachelor_transcript", label: "Bachelor's Transcript (if applicable)" },
                { doc_type: "passport", label: "Passport" },
                { doc_type: "english_proficiency", label: "English Proficiency Certificate (IELTS/TOEFL)" },
              ],
            };
            setCatalogue([...unis, genericEntry]);
            setSelectedId(genericEntry.id);
          }
        }
        setPhase("intake");
      } catch (e) {
        if (cancelled) return;
        setError(messageOf(e));
        setPhase("intake");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── restore a previously-confirmed name ────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) setFullName(saved);
    } catch {
      /* storage unavailable — name simply isn't prefilled */
    }
  }, []);

  // ── body scroll lock + escape to close ────────────────────────────────────
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const selected = useMemo<VerifyUniversity | null>(
    () => catalogue.find((v) => v.id === selectedId) ?? null,
    [catalogue, selectedId]
  );

  const requiredDocs: VerifyRequiredDocument[] = selected?.required_documents ?? [];
  const uploadedCount = requiredDocs.filter((d) => files[d.doc_type]).length;
  const allUploaded = requiredDocs.length > 0 && uploadedCount === requiredDocs.length;
  const nameReady = fullName.trim().length > 0;

  function pickUniversity(id: string) {
    setSelectedId(id);
    setFiles({}); // the checklist changes with the university — reset uploads
    setReport(null);
  }

  function setFile(docType: string, file: File | null) {
    setFiles((prev) => ({ ...prev, [docType]: file }));
  }

  async function run() {
    if (!selected) return;
    setNameTouched(true);
    if (!nameReady) return;
    setPhase("verifying");
    setError("");
    try {
      try {
        localStorage.setItem(NAME_KEY, fullName.trim());
      } catch {
        /* non-fatal */
      }

      const record = buildApplicantRecord(profile, university, fullName);
      const form = new FormData();
      form.append("student_id", buildStudentId(fullName));
      form.append("university_id", selected.id);
      form.append("applicant_record", JSON.stringify(record));
      for (const d of requiredDocs) {
        const f = files[d.doc_type];
        if (f) {
          form.append("doc_types", d.doc_type);
          form.append("files", f, f.name);
        }
      }

      const out = await api.verifyRun(form);
      setReport(out);
      setPhase("report");
    } catch (e) {
      setError(messageOf(e));
      setPhase("intake");
    }
  }

  // ── render ───────────────────────────────────────────────────────────────
  // Portal to document.body so the fixed overlay escapes any ancestor
  // containing block (the .panel cards use backdrop-filter, which establishes a
  // containing block for position:fixed descendants). Same reasoning as SopFlow.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Document Verification"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.26, ease: "easeOut" }}
        className="panel relative my-8 w-full max-w-shell overflow-hidden rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5 sm:px-8">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-deep">
              <ShieldCheck className="h-4 w-4" aria-hidden /> Document Verification
            </p>
            <h2 className="mt-1 truncate font-serif text-xl font-semibold sm:text-2xl">
              {university?.name ?? "Verify your documents"}
            </h2>
            <p className="mt-0.5 truncate text-[13px] text-ink-faint">
              {university
                ? `${university.city}, ${university.country} · Document readiness check`
                : "Final step — confirm your documents are application-ready"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-ink-faint transition-colors hover:bg-white/10 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="px-6 py-6 sm:px-8 sm:py-7">
          <AnimatePresence mode="wait">
            {phase === "loading" && (
              <motion.div key="loading" {...fade} className="flex flex-col items-center gap-3 py-16 text-center">
                <Spinner label="Preparing the verification checklist…" />
              </motion.div>
            )}

            {phase === "intake" && (
              <motion.div key="intake" {...fade} className="space-y-6">
                <p className="text-[15px] leading-relaxed text-ink-soft">
                  I already have your academic record, scores, and course from earlier — I&apos;ll
                  check each document against those. Just confirm your name and attach the documents
                  this university requires.
                </p>

                {error && (
                  <DangerAlert title="Verification couldn't run">
                    {error}{" "}
                    <button className="font-semibold underline" onClick={run}>
                      Try again
                    </button>
                  </DangerAlert>
                )}

                {/* one-time name confirm */}
                <Field
                  label="Your full name (as it appears on your documents)"
                  hint="Used only to check that each document belongs to you."
                  error={nameTouched && !nameReady ? "Please add your name so documents can be matched to you." : undefined}
                  icon={<FileUp className="h-4 w-4" />}
                >
                  <input
                    className={inputClass}
                    placeholder="e.g. Ananya Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </Field>

                {/* document checklist */}
                {!selected && (
                  <Callout>
                    Loading document requirements for {university?.name || "this university"}...
                  </Callout>
                )}

                {selected && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-serif text-base font-semibold text-ink-soft">
                        Required documents
                      </p>
                      <span className="text-xs font-medium text-ink-faint">
                        {uploadedCount} of {requiredDocs.length} attached
                      </span>
                    </div>
                    <ul className="space-y-2.5">
                      {requiredDocs.map((d) => (
                        <DocSlot
                          key={d.doc_type}
                          doc={d}
                          file={files[d.doc_type] ?? null}
                          onChange={(f) => setFile(d.doc_type, f)}
                        />
                      ))}
                    </ul>
                    {!allUploaded && (
                      <Hint>
                        Attach every required document for a complete readiness check. You can run
                        with some missing, but the report will mark the application incomplete.
                      </Hint>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    variant="primary"
                    onClick={run}
                    disabled={!selected || !nameReady || uploadedCount === 0}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    {allUploaded ? "Run verification" : `Verify ${uploadedCount} document${uploadedCount === 1 ? "" : "s"}`}
                  </Button>
                  {!allUploaded && selected && (
                    <span className="text-xs text-ink-faint">
                      {requiredDocs.length - uploadedCount} still missing
                    </span>
                  )}
                </div>
              </motion.div>
            )}

            {phase === "verifying" && (
              <motion.div key="verifying" {...fade} className="flex flex-col items-center gap-4 py-16 text-center">
                <Spinner label="Verifying your documents…" />
                <p className="max-w-sm text-sm leading-relaxed text-ink-faint">
                  Running tamper scans, reading each document, and cross-checking the details against
                  your profile. This can take a few seconds per document.
                </p>
              </motion.div>
            )}

            {phase === "report" && report && (
              <motion.div key="report" {...fade} className="space-y-5">
                <ReportView
                  report={report}
                  onEdit={() => setPhase("intake")}
                  onContinueApply={onContinueApply}
                  fullName={fullName}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// ── document upload slot ─────────────────────────────────────────────────────

function DocSlot({
  doc,
  file,
  onChange,
}: {
  doc: VerifyRequiredDocument;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <li
      className={`well flex items-center gap-3 rounded-2xl border p-3.5 transition-colors ${
        file ? "border-green/30" : "border-line"
      }`}
    >
      <span
        className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${
          file ? "bg-green-wash text-green" : "bg-blue-wash text-blue-deep"
        }`}
      >
        {file ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <Upload className="h-5 w-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{doc.label}</p>
        <p className="truncate text-xs text-ink-faint">
          {file ? file.name : "PDF or image — not attached yet"}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex flex-none items-center gap-2">
          <Button variant="link" onClick={() => inputRef.current?.click()}>
            Replace
          </Button>
          <button
            onClick={() => onChange(null)}
            aria-label={`Remove ${doc.label}`}
            className="rounded-full p-1.5 text-ink-faint transition-colors hover:bg-white/10 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Button variant="soft" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" /> Attach
        </Button>
      )}
    </li>
  );
}

// ── report view ──────────────────────────────────────────────────────────────

function ReportView({
  report,
  onEdit,
  onContinueApply,
  fullName,
}: {
  report: VerifyReport;
  onEdit: () => void;
  /** Optional handoff into the Application Automation overlay after a VERIFIED result. */
  onContinueApply?: (fullName: string) => void;
  fullName?: string;
}) {
  const ready = report.overall_verdict === "VERIFIED";
  const incomplete = report.overall_verdict === "INCOMPLETE" || report.missing_documents.length > 0;

  return (
    <div className="space-y-5">
      {/* overall readiness banner */}
      <AnalysisCard
        title={report.overall_verdict_label}
        foot={`Checked against ${report.registry_name} · ${report.documents.length} document${
          report.documents.length === 1 ? "" : "s"
        } analysed`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`tag ${
              ready ? "tag-green" : incomplete ? "tag-amber" : "tag-amber"
            }`}
          >
            {ready ? (
              <>
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Application ready
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Needs attention
              </>
            )}
          </span>
          <span className="tag tag-neutral">Trust score {report.overall_trust_score}/100</span>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          {ready
            ? "Every required document is present and consistent with your profile. You're ready to submit this application."
            : incomplete
            ? "Your application isn't complete yet. Add the missing documents below and re-run the check."
            : "Some documents need a second look before you submit. Review the notes below and re-upload anything flagged."}
        </p>
      </AnalysisCard>

      {/* missing documents */}
      {report.missing_documents.length > 0 && (
        <Callout>
          <span className="font-semibold">Missing: </span>
          {report.missing_documents.join(", ")}. Attach{" "}
          {report.missing_documents.length === 1 ? "it" : "them"} and run the check again.
        </Callout>
      )}

      {/* per-document ledger */}
      <div className="space-y-2.5">
        <p className="font-serif text-base font-semibold text-ink-soft">Document by document</p>
        <ul className="space-y-2.5">
          {report.documents.map((d) => (
            <DocumentRow key={d.doc_type} doc={d} />
          ))}
          {report.missing_documents.map((label) => (
            <li
              key={label}
              className="well flex items-start gap-3 rounded-2xl border border-amber/25 p-4"
            >
              <MinusCircle className="mt-0.5 h-5 w-5 flex-none text-amber" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{label}</p>
                <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-amber">Missing</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-faint">
                  Required document not uploaded.
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* student alerts */}
      {report.student_alerts.length > 0 && (
        <div className="well p-4">
          <p className="mb-2.5 flex items-center gap-2 font-serif text-base font-semibold text-ink-soft">
            <FileWarning className="h-4 w-4" aria-hidden /> What to fix
          </p>
          <ul className="space-y-2">
            {report.student_alerts.map((a, i) => (
              <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft">
                <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-amber" aria-hidden />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {ready && onContinueApply ? (
          <motion.span
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.36, ease: "easeOut" }}
            className="inline-flex rounded-full"
          >
            <Button
              variant="primary"
              onClick={() => onContinueApply((fullName ?? "").trim())}
            >
              <Send className="h-4 w-4" /> Continue to Apply
            </Button>
          </motion.span>
        ) : (
          <Button variant="primary" onClick={onEdit}>
            <FileUp className="h-4 w-4" /> Update documents
          </Button>
        )}
        {ready && onContinueApply && (
          <Button variant="outline" onClick={onEdit}>
            <FileUp className="h-4 w-4" /> Update documents
          </Button>
        )}
      </div>
    </div>
  );
}

function DocumentRow({ doc }: { doc: VerifyReport["documents"][number] }) {
  const verified = doc.verdict === "VERIFIED";
  const flagged = doc.verdict === "FLAGGED";
  const rejected = doc.verdict === "REJECTED";

  const { Icon, tone, statusText } = verified
    ? { Icon: CheckCircle2, tone: "text-green", statusText: "Verified" }
    : rejected
    ? { Icon: XCircle, tone: "text-red", statusText: "Rejected" }
    : { Icon: AlertTriangle, tone: "text-amber", statusText: "Needs attention" };

  const reason = doc.student_alerts[0] ??
    (verified
      ? "Information matches your student profile."
      : doc.flags[0] ?? "Review this document before submitting.");

  return (
    <li
      className={`well flex items-start gap-3 rounded-2xl border p-4 ${
        verified ? "border-green/25" : rejected ? "border-red/25" : "border-amber/25"
      }`}
    >
      <Icon className={`mt-0.5 h-5 w-5 flex-none ${tone}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-ink">{doc.doc_label}</p>
          <span className={`text-xs font-semibold uppercase tracking-wide ${tone}`}>
            {statusText} · {doc.trust_score}/100
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink-faint">{reason}</p>
      </div>
    </li>
  );
}

// ── small presentational helpers ────────────────────────────────────────────

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue/30 border-t-blue-deep" />
      <p className="text-sm font-medium text-ink-soft">{label}</p>
    </div>
  );
}

// ── motion presets ──────────────────────────────────────────────────────────

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: "easeOut" as const },
};

// ── pure helpers ────────────────────────────────────────────────────────────

/**
 * The only error text a student ever sees. The real cause (HTTP status, error
 * body, stack) is logged server-side; the UI never surfaces backend messages,
 * diagnostics, env detail, or model internals.
 */
const FRIENDLY_ERROR = "We couldn't process your request right now. Please try again.";

function messageOf(_e: unknown): string {
  return FRIENDLY_ERROR;
}
