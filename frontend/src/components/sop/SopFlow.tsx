"use client";

/**
 * SopFlow — the in-app Statement of Purpose generator.
 *
 * This is NOT a route. It is a fixed full-viewport overlay rendered on top of
 * the results page when a student clicks "Generate SOP" on a university card.
 * It reuses every piece of profile data already collected (academic record,
 * scores, target course, the selected university) and only asks for the
 * narrative fields that are still missing — then drafts the SOP through the
 * embedded backend and shows it inline. Nothing redirects, nothing opens a
 * second app; the SOP module behaves like a native feature of the University
 * Agent.
 *
 * Flow: /interview/start (adaptive plan: what's known vs. what's worth asking)
 * -> one-question-at-a-time stepper with structured inputs (single/multi
 * select + "Other" + optional detail, short/long text), adaptive follow-ups
 * spliced in from /interview/followup when an answer has more to give ->
 * generate (template or AI, with an optional live-research toggle) -> rendered
 * draft with quality report, key points, warnings, disclaimer + a revise loop
 * + copy/download. Question count is emergent, never a fixed list.
 *
 * Answers a student types are persisted to their own localStorage key
 * (study-abroad-sop-answers-v1), separate from the study-abroad profile, so a
 * return visit never re-asks anything already answered.
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Copy,
  Download,
  FileText,
  Globe,
  RefreshCw,
  SkipForward,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import { buildSopAnswers, buildSopTarget, sopOptions } from "@/lib/sop";
import {
  AnalysisCard,
  Callout,
  DangerAlert,
  Hint,
  InsightPanel,
} from "@/components/ui/Panels";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { VerifyFlow } from "@/components/verify/VerifyFlow";
import type { StudentPayload, University } from "@/types/api";
import type {
  SopFollowUp,
  SopGenerateResponse,
  SopInterviewPlan,
  SopQuestion,
  SopStudentProfile,
  SopUniversityTarget,
} from "@/types/sop";

const ANSWERS_KEY = "study-abroad-sop-answers-v1";

type Phase = "checking" | "interview" | "ready" | "generating" | "result" | "revising";

export function SopFlow({
  university,
  profile,
  onClose,
  onContinueApplication,
}: {
  university: University;
  profile: StudentPayload;
  onClose: () => void;
  /**
   * Advances the student to the next stage of the journey (Document
   * Verification). When provided, a "Continue application" action appears
   * alongside the existing draft actions. The host owns the transition, so the
   * SOP stage stays unaware of what comes next — the same hook works for future
   * stages (LOR, Visa, Scholarship, Interview Prep).
   */
  onContinueApplication?: () => void;
}) {
  const target = useMemo<SopUniversityTarget>(
    () => buildSopTarget(university, profile),
    [university, profile]
  );

  // Answers: merge persisted narrative answers with the freshly-derived
  // academic record (see mergeAnswers for the precedence rule).
  const [answers, setAnswers] = useState<SopStudentProfile>(() =>
    mergeAnswers(buildSopAnswers(profile))
  );

  const [phase, setPhase] = useState<Phase>("checking");
  const [plan, setPlan] = useState<SopInterviewPlan | null>(null);
  const [questions, setQuestions] = useState<SopQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [followupLoading, setFollowupLoading] = useState(false);
  // Structured-input scratch state for select UIs, keyed by question key.
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [customs, setCustoms] = useState<Record<string, string>>({});
  const [details, setDetails] = useState<Record<string, string>>({});
  const [fieldError, setFieldError] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SopGenerateResponse | null>(null);
  const [draft, setDraft] = useState("");
  const [research, setResearch] = useState(false);
  const [reviseFeedback, setReviseFeedback] = useState("");
  const [showRevise, setShowRevise] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  // ── persistence: remember typed answers across visits ────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(ANSWERS_KEY, JSON.stringify(answers));
    } catch {
      /* quota / private mode — non-fatal, in-memory state still works */
    }
  }, [answers]);

  // ── body scroll lock + escape to close ───────────────────────────────────
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

  // ── initial adaptive-interview plan: known vs. worth asking ───────────────
  useEffect(() => {
    let cancelled = false;
    runInterview();
    async function runInterview() {
      setError("");
      try {
        const p = await api.sopInterviewStart({
          answers,
          target,
          include_optional: false,
        });
        if (cancelled) return;
        setPlan(p);
        setQuestions(p.questions);
        if (p.questions.length === 0) {
          setPhase("ready");
        } else {
          setQIndex(0);
          setPhase("interview");
        }
      } catch (e) {
        if (cancelled) return;
        // Don't block the student: let them attempt a direct generate.
        setError(messageOf(e));
        setPhase("ready");
      }
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // focus the current input whenever the stepper advances
  useEffect(() => {
    if (phase === "interview") inputRef.current?.focus();
  }, [phase, qIndex]);

  const current = questions[qIndex];
  const currentIsSelect = isSelectUI(current?.ui);

  function answerCurrent(value: string) {
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [current.key]: value }));
    if (fieldError) setFieldError("");
  }

  // Select/multi-select UIs: compose options + custom "Other" + optional
  // detail into one answer string and keep `answers` in sync with them.
  useEffect(() => {
    if (phase !== "interview" || !current || !isSelectUI(current.ui)) return;
    const picks = (selections[current.key] ?? []).filter(Boolean);
    const custom = (customs[current.key] ?? "").trim();
    const parts = [...picks];
    if (custom) parts.push(custom);
    let value = parts.join("; ");
    const detail = (details[current.key] ?? "").trim();
    if (detail) value = value ? `${value}\n\n${detail}` : detail;
    setAnswers((prev) =>
      prev[current.key] === value ? prev : { ...prev, [current.key]: value }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections, customs, details, qIndex, phase]);

  function toggleOption(opt: string) {
    if (!current) return;
    setSelections((prev) => {
      const cur = prev[current.key] ?? [];
      const next =
        current.ui === "multi_select"
          ? cur.includes(opt)
            ? cur.filter((o) => o !== opt)
            : [...cur, opt]
          : cur.includes(opt)
            ? []
            : [opt];
      return { ...prev, [current.key]: next };
    });
  }

  /**
   * Adaptive follow-up: after a meaningful answer to a probeable field, ask
   * the backend whether this specific answer deserves a targeted follow-up.
   * It decides value ("None" / thin answers -> null); we never chain deeper
   * than one hop per question. The follow-up is spliced into the queue right
   * after its parent; its text is merged into the parent field before
   * generation so nothing the student wrote is dropped by the API schema.
   */
  async function nextQuestion() {
    if (!current || followupLoading) return;
    const value = (answers[current.key] ?? "").trim();
    if (current.importance === "required" && !value) {
      setFieldError("Please add a few words here so your statement is complete.");
      return;
    }
    setFieldError("");
    if (FOLLOWUP_KEYS.has(current.key) && value.split(/\s+/).length >= 5) {
      setFollowupLoading(true);
      try {
        const res = await api.sopInterviewFollowup({
          answers,
          key: current.key,
          answer: value,
        });
        const fu: SopFollowUp | null = res.follow_up;
        if (fu && !questions.some((q) => q.key === fu.key)) {
          setQuestions((prevQs) => {
            const copy = [...prevQs];
            copy.splice(qIndex + 1, 0, {
              key: fu.key,
              label: "",
              question: fu.question,
              importance: "optional",
              category: current.category,
              help_text: fu.why ?? "",
              example: "",
              multiline: true,
              ui: (fu.ui as SopQuestion["ui"]) ?? "long_text",
              skippable: true,
            });
            return copy;
          });
        }
      } catch {
        /* follow-up is advisory — never block the interview on it */
      }
      setFollowupLoading(false);
    }
    advance();
  }

  function advance() {
    if (qIndex + 1 < questions.length) setQIndex(qIndex + 1);
    else setPhase("ready");
  }

  function prevQuestion() {
    setFieldError("");
    if (qIndex > 0) setQIndex(qIndex - 1);
  }

  function skipCurrent() {
    if (!current) return;
    setFieldError("");
    advance();
  }

  async function generate() {
    setPhase("generating");
    setError("");
    try {
      const out = await api.sopGenerate({
        target,
        answers: mergeFollowUps(answers),
        options: sopOptions(research),
        insights: null,
      });
      setResult(out);
      setDraft(out.sop_text);
      setShowRevise(false);
      setReviseFeedback("");
      setPhase("result");
    } catch (e) {
      setError(messageOf(e));
      setPhase("ready");
    }
  }

  async function revise() {
    if (!result || !reviseFeedback.trim()) return;
    setPhase("revising");
    setError("");
    try {
      const out = await api.sopRevise({
        sop_text: draft,
        key_points: result.key_points,
        feedback: reviseFeedback.trim(),
        target,
        options: sopOptions(false),
      });
      setResult(out);
      setDraft(out.sop_text);
      setShowRevise(false);
      setReviseFeedback("");
      setPhase("result");
    } catch (e) {
      setError(messageOf(e));
      setPhase("result");
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      /* clipboard blocked in some browsers — non-fatal */
    }
  }

  function downloadDraft() {
    const blob = new Blob([draft], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sop-${slug(university.name)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── render ───────────────────────────────────────────────────────────────
  // Portal to document.body so the fixed overlay escapes any ancestor
  // containing block. The .panel card that hosts the "Generate SOP" button
  // uses backdrop-filter (backdrop-blur), which per the CSS spec establishes a
  // containing block for position:fixed descendants — without the portal the
  // overlay would be clipped to the card's box instead of covering the
  // viewport. SopFlow only ever mounts after a client click, so document is
  // available; the guard is defensive for SSR.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Generate Statement of Purpose"
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
              <Sparkles className="h-4 w-4" aria-hidden /> Statement of Purpose
            </p>
            <h2 className="mt-1 truncate font-serif text-xl font-semibold sm:text-2xl">
              {university.name}
            </h2>
            <p className="mt-0.5 truncate text-[13px] text-ink-faint">
              {university.courseName} · {university.country}
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
            {phase === "checking" && (
              <motion.div key="checking" {...fade} className="flex flex-col items-center gap-3 py-16 text-center">
                <Spinner label="Reading your profile…" />
              </motion.div>
            )}

            {phase === "interview" && current && (
              <motion.div key={`q-${qIndex}`} {...stepFade} className="space-y-5">
                <InterviewProgress questions={questions} index={qIndex} />
                {qIndex === 0 && plan && (
                  <KnownPanel known={plan.known} answers={answers} />
                )}
                {current.why && (
                  <p className="text-xs italic leading-relaxed text-ink-faint">
                    {current.why}
                  </p>
                )}
                <Field
                  label={current.label || current.question}
                  hint={current.label ? current.help_text || undefined : undefined}
                  error={fieldError || undefined}
                  icon={<Wand2 className="h-4 w-4" />}
                >
                  {currentIsSelect ? (
                    <div
                      className="space-y-2"
                      role={current.ui === "multi_select" ? "group" : "radiogroup"}
                      aria-label={current.label || current.question}
                    >
                      {(current.options ?? []).map((opt) => {
                        const active = (selections[current.key] ?? []).includes(opt);
                        return (
                          <button
                            key={opt}
                            type="button"
                            role={current.ui === "multi_select" ? "checkbox" : "radio"}
                            aria-checked={active}
                            onClick={() => toggleOption(opt)}
                            className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ${
                              active
                                ? "border-blue bg-blue/10 font-medium text-blue-deep"
                                : "border-line text-ink-soft hover:bg-white/5"
                            }`}
                          >
                            <span
                              aria-hidden
                              className={`flex h-4 w-4 shrink-0 items-center justify-center border text-[10px] leading-none ${
                                current.ui === "multi_select" ? "rounded-[4px]" : "rounded-full"
                              } ${active ? "border-blue-deep bg-blue-deep text-white" : "border-ink-faint/40"}`}
                            >
                              ✓
                            </span>
                            {opt}
                          </button>
                        );
                      })}
                      <input
                        aria-label="Other"
                        className={inputClass}
                        placeholder="Other — type your own answer…"
                        value={customs[current.key] ?? ""}
                        onChange={(e) =>
                          setCustoms((p) => ({ ...p, [current.key]: e.target.value }))
                        }
                      />
                      <textarea
                        aria-label="Optional detail"
                        className={`${inputClass} min-h-[64px] resize-y`}
                        placeholder="Want to tell us more? (optional)"
                        value={details[current.key] ?? ""}
                        onChange={(e) =>
                          setDetails((p) => ({ ...p, [current.key]: e.target.value }))
                        }
                      />
                    </div>
                  ) : current.multiline ? (
                    <textarea
                      ref={inputRef as RefObject<HTMLTextAreaElement>}
                      className={`${inputClass} min-h-[120px] resize-y leading-relaxed`}
                      placeholder={current.example || "Type your answer…"}
                      value={answers[current.key] ?? ""}
                      onChange={(e) => answerCurrent(e.target.value)}
                      rows={5}
                    />
                  ) : (
                    <input
                      ref={inputRef as RefObject<HTMLInputElement>}
                      className={inputClass}
                      placeholder={current.example || "Type your answer…"}
                      value={answers[current.key] ?? ""}
                      onChange={(e) => answerCurrent(e.target.value)}
                    />
                  )}
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    onClick={prevQuestion}
                    disabled={qIndex === 0}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-faint transition-colors hover:text-ink disabled:opacity-40"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back
                  </button>
                  <div className="flex items-center gap-3">
                    {(current.skippable ?? current.importance !== "required") && (
                      <button
                        onClick={skipCurrent}
                        disabled={followupLoading}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-faint transition-colors hover:text-ink disabled:opacity-40"
                      >
                        <SkipForward className="h-4 w-4" /> Skip
                      </button>
                    )}
                    <Button variant="primary" onClick={nextQuestion}>
                      {followupLoading
                        ? "Thinking…"
                        : qIndex + 1 < questions.length
                          ? "Continue"
                          : "Review"}{" "}
                      {!followupLoading && <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {phase === "ready" && (
              <motion.div key="ready" {...fade} className="space-y-5">
                <p className="text-[15px] leading-relaxed text-ink-soft">
                  {questions.length > 0
                    ? "Got it. I have your academic record, scores, and the details above. Ready to draft your statement of purpose."
                    : "Your profile already has everything I need. Ready to draft your statement of purpose."}
                </p>
                {plan && <KnownPanel known={plan.known} answers={answers} />}
                <label className="well flex cursor-pointer items-start gap-3 p-4">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[#5b6cff]"
                    checked={research}
                    onChange={(e) => setResearch(e.target.checked)}
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      <Globe className="h-4 w-4 text-blue-deep" /> Enrich with live web research
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-faint">
                      Pulls fresh details about the program and faculty. Slower, and needs the
                      research backend enabled.
                    </span>
                  </span>
                </label>
                {error && (
                  <DangerAlert title="Something went wrong">
                    {error}{" "}
                    <button className="font-semibold underline" onClick={generate}>
                      Try generating anyway
                    </button>
                  </DangerAlert>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button variant="primary" onClick={generate}>
                    <Sparkles className="h-4 w-4" /> Generate SOP
                  </Button>
                  {questions.length > 0 && (
                    <Button
                      variant="link"
                      onClick={() => {
                        setQIndex(0);
                        setPhase("interview");
                      }}
                    >
                      Review my answers
                    </Button>
                  )}
                </div>
              </motion.div>
            )}

            {phase === "generating" && (
              <motion.div key="generating" {...fade} className="flex flex-col items-center gap-4 py-16 text-center">
                <Spinner
                  label={research ? "Researching the program, then drafting…" : "Drafting your statement of purpose…"}
                />
                <p className="max-w-sm text-sm leading-relaxed text-ink-faint">
                  This can take a few seconds. We&apos;re shaping a personalised draft from your details.
                </p>
              </motion.div>
            )}

            {phase === "revising" && (
              <motion.div key="revising" {...fade} className="flex flex-col items-center gap-3 py-16 text-center">
                <Spinner label="Revising your statement…" />
              </motion.div>
            )}

            {phase === "result" && result && (
              <motion.div key="result" {...fade} className="space-y-5">
                <ResultView
                  result={result}
                  draft={draft}
                  showRevise={showRevise}
                  reviseFeedback={reviseFeedback}
                  onToggleRevise={() => setShowRevise((v) => !v)}
                  onFeedback={setReviseFeedback}
                  onRevise={revise}
                  onCopy={copyDraft}
                  onDownload={downloadDraft}
                  onRegenerate={generate}
                  onContinueApplication={() => setVerifyOpen(true)}
                  error={error}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      {verifyOpen && (
        <VerifyFlow
          university={university}
          profile={profile}
          onClose={() => setVerifyOpen(false)}
        />
      )}
    </div>,
    document.body
  );
}

// ── result view ─────────────────────────────────────────────────────────────

function ResultView({
  result,
  draft,
  showRevise,
  reviseFeedback,
  onToggleRevise,
  onFeedback,
  onRevise,
  onCopy,
  onDownload,
  onRegenerate,
  onContinueApplication,
  error,
}: {
  result: SopGenerateResponse;
  draft: string;
  showRevise: boolean;
  reviseFeedback: string;
  onToggleRevise: () => void;
  onFeedback: (v: string) => void;
  onRevise: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onRegenerate: () => void;
  onContinueApplication: () => void;
  error: string;
}) {
  const q = result.quality;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tag tag-blue">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Your draft
        </span>
        <span className="tag tag-neutral">{result.word_count} words</span>
      </div>

      {result.warnings.map((w, i) => (
        <Callout key={i}>{w}</Callout>
      ))}

      <VerificationNotice status={result.research_status} />

      <AnalysisCard title="Your Statement of Purpose" foot={result.disclaimer}>
        <div className="whitespace-pre-wrap font-serif text-[15px] leading-[1.85] text-ink">
          {draft}
        </div>
      </AnalysisCard>

      {result.change_note && <Hint>What changed: {result.change_note}</Hint>}

      {result.key_points.length > 0 && (
        <InsightPanel
          tone="green"
          title="Key points covered"
          points={result.key_points}
          empty="—"
        />
      )}

      <div className="well p-4">
        <p className="mb-3 flex items-center gap-2 font-serif text-base font-semibold text-ink-soft">
          <FileText className="h-4 w-4" aria-hidden /> Quality check
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-3">
          <Stat k="Length" v={q.length_verdict} />
          <Stat k="Words" v={String(q.word_count)} />
          <Stat k="Paragraphs" v={String(q.paragraph_count)} />
          <Stat k="Target" v={q.target_word_count ? `${q.target_word_count} words` : "default"} />
          <Stat k="Clichés" v={String(q.cliche_count)} />
          <Stat k="Placeholders" v={String(q.placeholder_count)} />
        </dl>
        {q.placeholder_count > 0 && (
          <Callout>
            Your draft still has {q.placeholder_count} bracketed placeholder
            {q.placeholder_count > 1 ? "s" : ""} — fill in the missing details or answer the related
            question and regenerate for a cleaner statement.
          </Callout>
        )}
      </div>

      {error && <DangerAlert title="Revision failed">{error}</DangerAlert>}

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" onClick={onContinueApplication}>
          <ArrowRight className="h-4 w-4" /> Continue application
        </Button>
        <Button variant="soft" onClick={onCopy}>
          <Copy className="h-4 w-4" /> Copy
        </Button>
        <Button variant="soft" onClick={onDownload}>
          <Download className="h-4 w-4" /> Download
        </Button>
        <Button variant="outline" onClick={onToggleRevise}>
          <RefreshCw className="h-4 w-4" /> {showRevise ? "Cancel revise" : "Revise"}
        </Button>
        <Button variant="link" onClick={onRegenerate}>
          <Sparkles className="h-4 w-4" /> Regenerate
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {showRevise && (
          <motion.div
            key="revise"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="well space-y-3 p-4">
              <Field
                label="What should change?"
                hint="e.g. Make the opening more personal, emphasise my data science projects, shorten the conclusion."
              >
                <textarea
                  className={`${inputClass} min-h-[90px] resize-y leading-relaxed`}
                  placeholder="Describe the changes you want…"
                  value={reviseFeedback}
                  onChange={(e) => onFeedback(e.target.value)}
                  rows={3}
                />
              </Field>
              <Button variant="primary" onClick={onRevise} disabled={!reviseFeedback.trim()}>
                <RefreshCw className="h-4 w-4" /> Apply revision
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── small presentational helpers ────────────────────────────────────────────

/**
 * Clean verification status derived from the backend's structured
 * `research_status`. Students see a calm one-liner at most — never raw
 * errors, URLs, or internal tool messages. Silent statuses render nothing.
 */
function VerificationNotice({
  status,
}: {
  status: SopGenerateResponse["research_status"];
}) {
  if (status === "verified" || status === "partial") {
    return (
      <Hint>
        <BadgeCheck className="mr-1 inline h-4 w-4 text-emerald-600" aria-hidden />
        University details were checked against official public sources.
      </Hint>
    );
  }
  if (status === "disabled" || status === "skipped" || status === "not_run") {
    return null;
  }
  // failed | timeout | unavailable | no_results: degrade gracefully and quietly.
  return (
    <Hint>
      Some external university details couldn&apos;t be verified right now, so UniQ
      left them out of your draft.
    </Hint>
  );
}

// ── adaptive-interview pieces ───────────────────────────────────────────────

/** Fields the backend's follow-up engine can probe (services/interview.py). */
const FOLLOWUP_KEYS = new Set([
  "why_this_field",
  "work_experience",
  "research_or_projects",
  "career_goals_short_term",
]);

function isSelectUI(ui?: string): boolean {
  return ui === "single_select" || ui === "multi_select";
}

/**
 * Fold follow-up answers (stored under synthetic `parent__probe` keys) back
 * into their parent field before generation, so the API schema — which knows
 * only the 13 canonical fields — keeps every word the student wrote.
 */
function mergeFollowUps(a: SopStudentProfile): SopStudentProfile {
  const out: SopStudentProfile = { ...a };
  Object.keys(out).forEach((k) => {
    if (!k.includes("__")) return;
    const parent = k.split("__")[0] as keyof SopStudentProfile;
    const v = out[k];
    if (typeof v === "string" && v.trim()) {
      out[parent] = out[parent] ? `${out[parent]}\n\n${v}` : v;
    }
    delete out[k];
  });
  return out;
}

/**
 * Category progress — deliberately NOT "Question X of Y": the interview has
 * no fixed length. Chips show which areas are covered (✓), active (●) and
 * still open (○).
 */
function InterviewProgress({
  questions,
  index,
}: {
  questions: SopQuestion[];
  index: number;
}) {
  const cats: string[] = [];
  questions.forEach((q) => {
    if (!cats.includes(q.category)) cats.push(q.category);
  });
  const activeCat = questions[index]?.category;
  const passed = new Set(questions.slice(0, index).map((q) => q.category));
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Building your SOP profile
      </p>
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => {
          const done = passed.has(c) && c !== activeCat;
          const active = c === activeCat;
          return (
            <span
              key={c}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
                done
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                  : active
                    ? "border-blue bg-blue/10 text-blue-deep"
                    : "border-line text-ink-faint"
              }`}
            >
              {done ? "✓ " : active ? "● " : "○ "}
              {c}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * "UniQ remembers you" panel — everything already known from the profile,
 * shown once and never asked again.
 */
function KnownPanel({
  known,
  answers,
}: {
  known: { key: string; label: string }[];
  answers: SopStudentProfile;
}) {
  if (!known.length) return null;
  return (
    <div className="well rounded-2xl p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-deep">
        Already in your UniQ profile
      </p>
      <ul className="mt-2 space-y-1">
        {known.map((k) => {
          const v = answers[k.key] ?? "";
          return (
            <li key={k.key} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="shrink-0 text-ink-faint">{k.label}</span>
              <span className="truncate text-right font-medium text-ink-soft">
                {v.length > 70 ? `${v.slice(0, 70)}…` : v}{" "}
                <span aria-hidden className="text-emerald-600">✓</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-faint">
        We won&apos;t ask for anything you&apos;ve already told us.
      </p>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue/30 border-t-blue-deep" />
      <p className="text-sm font-medium text-ink-soft">{label}</p>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{k}</dt>
      <dd className="font-medium text-ink-soft">{v}</dd>
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

const stepFade = {
  initial: { opacity: 0, x: 14 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -14 },
  transition: { duration: 0.22, ease: "easeOut" as const },
};

// ── pure helpers ────────────────────────────────────────────────────────────

/**
 * Merge persisted answers with the freshly-derived ones. Narrative fields the
 * student already typed win (so a return visit doesn't re-ask). The
 * academic_achievements field is owned by the profile: keep the fresh
 * auto-derived value when the profile has scores, otherwise fall back to a
 * previously-typed answer so the student isn't re-asked.
 */
function mergeAnswers(fresh: SopStudentProfile): SopStudentProfile {
  let persisted: Partial<SopStudentProfile> = {};
  try {
    const raw = localStorage.getItem(ANSWERS_KEY);
    if (raw) persisted = JSON.parse(raw) as Partial<SopStudentProfile>;
  } catch {
    /* corrupt storage — start fresh */
  }
  const merged: SopStudentProfile = { ...fresh };
  (Object.keys(merged) as (keyof SopStudentProfile)[]).forEach((key) => {
    const p = persisted[key];
    if (key === "academic_achievements") {
      merged.academic_achievements =
        fresh.academic_achievements ?? (typeof p === "string" ? p : null);
    } else if (typeof p === "string") {
      (merged as Record<string, unknown>)[key] = p;
    }
  });
  return merged;
}

/**
 * The only error text a student ever sees. The real cause (HTTP status, error
 * body, stack) is logged server-side; the UI never surfaces backend messages,
 * diagnostics, env detail, or model internals.
 */
const FRIENDLY_ERROR = "We couldn't process your request right now. Please try again.";

function messageOf(_e: unknown): string {
  return FRIENDLY_ERROR;
}

/** Filesystem-safe slug for the download filename. */
function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "statement"
  );
}
