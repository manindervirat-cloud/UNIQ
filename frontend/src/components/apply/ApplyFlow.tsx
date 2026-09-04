"use client";

/**
 * ApplyFlow — the Apply-Now / Application Automation (Agent 4) surface.
 *
 * Same overlay pattern as SopFlow and VerifyFlow: a fixed, portal-mounted
 * full-viewport layer rendered on top of the results page, opened from the
 * card's Apply Now action (already verified) or chained from VerifyFlow's
 * report phase once verification passes. No route change, no separate tool.
 *
 * Journey position: University Agent -> SOP Agent -> Document Verification ->
 * Application Automation. The student never re-types anything already known —
 * name, scores, program, and verified documents all come from prior stages.
 *
 * Flow: resolve identity + catalogue id -> readiness gate -> live progress
 * (poll) -> pause/resume prompts (missing info / captcha / payment / submit)
 * -> success. The Apply Now button is always visible; it is *enabled* and
 * smoothly animates in only after readiness is confirmed.
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BadgeCheck,
  CreditCard,
  FileUp,
  Globe,
  Loader2,
  PauseCircle,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "@/lib/api";
import {
  buildApplyBody,
  checkApplyReadiness,
  getApplyApplication,
  resolveApplyUniversityId,
  resumeApply,
  startApply,
} from "@/lib/apply";
import { AnalysisCard, Callout, DangerAlert, Hint } from "@/components/ui/Panels";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import type { StudentPayload, University } from "@/types/api";
import type {
  ApplyApplication,
  ApplyInboxItem,
  ApplyPendingAction,
  ApplyReadiness,
} from "@/types/apply";

const NAME_KEY = "study-abroad-student-name-v1";
const FRIENDLY_ERROR = "We couldn't process your request right now. Please try again.";

type Phase = "loading" | "gate" | "running" | "success" | "inbox";

const POLL_MS = 1200;

/** Stage timeline rendered on the running screen. */
const STAGES: { status: string; label: string; hint: string }[] = [
  { status: "Preparing Application", label: "Preparing your application", hint: "Loading your verified profile" },
  { status: "Checking Eligibility", label: "Checking eligibility", hint: "Matching scores to the programme" },
  { status: "Checking Documents", label: "Checking documents", hint: "Confirming every requirement is met" },
  { status: "Ready to Apply", label: "Ready to apply", hint: "All checks passed" },
  { status: "Application Started", label: "Opening the portal", hint: "Starting a secure session" },
  { status: "Filling Application", label: "Filling the application", hint: "Auto-populating your details" },
  { status: "Uploading Documents", label: "Uploading documents", hint: "Attaching your verified files" },
  { status: "Submitted", label: "Submitting", hint: "Final review + submit" },
  { status: "Under Review", label: "Under review", hint: "The university is processing it" },
];

export function ApplyFlow({
  university,
  profile,
  fullName,
  verified,
  onClose,
}: {
  university: University | null;
  profile: StudentPayload;
  /** Carried from VerifyFlow when opened directly; falls back to storage. */
  fullName?: string;
  /** True when VerifyFlow passed verification and is handing off to Apply. */
  verified?: boolean;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [catalogue, setCatalogue] = useState<{ id: string; name: string }[]>([]);
  const [name, setName] = useState(fullName ?? "");
  const [nameTouched, setNameTouched] = useState(false);
  const [readiness, setReadiness] = useState<ApplyReadiness | null>(null);
  const [error, setError] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);

  const [application, setApplication] = useState<ApplyApplication | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const pollRef = useRef<number | null>(null);

  // ── resolve identity + catalogue id once ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let n = fullName ?? "";
        if (!n) {
          try {
            n = localStorage.getItem(NAME_KEY) ?? "";
          } catch {
            /* storage unavailable */
          }
        }
        if (!cancelled) setName(n);
        const unis = await api.verifyUniversities();
        if (!cancelled) setCatalogue(unis);
        if (!cancelled) setPhase("gate");
      } catch (e) {
        if (!cancelled) {
          setError(messageOf(e));
          setPhase("gate");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── body scroll lock + escape ─────────────────────────────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "running") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, phase]);

  const universityId = useMemo(
    () => resolveApplyUniversityId(university, catalogue),
    [university, catalogue]
  );
  const program = (university?.courseName || profile.targetCourse || "").trim() || undefined;
  const nameReady = name.trim().length > 0;

  // ── readiness gate ────────────────────────────────────────────────────────
  async function loadReadiness() {
    if (!universityId) return;
    setBusy(true);
    setError("");
    try {
      const r = await checkApplyReadiness(name.trim() || "student", universityId, program);
      setReadiness(r);
      setNeedsVerify(!r.eligible);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  // Start readiness check as soon as we have id + (pre-verified or stored) name.
  useEffect(() => {
    if (phase !== "gate" || !universityId || !nameReady) return;
    // Auto-check when verified name already exists; else wait for the name gate.
    if (name.trim()) void loadReadiness();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, universityId]);

  // ── polling ────────────────────────────────────────────────────────────────
  function stopPoll() {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPoll(id: string) {
    stopPoll();
    pollRef.current = window.setInterval(async () => {
      try {
        const app = await getApplyApplication(id);
        setApplication(app);
        if (isTerminal(app.status)) stopPoll();
      } catch {
        /* transient poll failures are tolerated; next tick retries */
      }
    }, POLL_MS);
  }

  useEffect(() => () => stopPoll(), []);

  // ── actions ────────────────────────────────────────────────────────────────
  async function begin() {
    if (!universityId) return;
    setBusy(true);
    setError("");
    try {
      const body = buildApplyBody(name, universityId, program);
      const started = await startApply(body);
      setApplicationId(started.application_id);
      setPhase("running");
      const app = await getApplyApplication(started.application_id);
      setApplication(app);
      startPoll(started.application_id);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitAction(action: ApplyPendingAction, payload?: Record<string, unknown>) {
    if (!applicationId) return;
    setBusy(true);
    setError("");
    try {
      await resumeApply(applicationId, { action, payload });
      startPoll(applicationId);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  const pending = application?.pending_student_action ?? null;
  const paused = !!pending;
  const stageIndex = STAGES.findIndex(
    (s) => application && indexOfStatus(application.status) >= indexOfStatus(s.status)
  );

  // ── render ─────────────────────────────────────────────────────────────────
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Application Automation"
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
              <Send className="h-4 w-4" aria-hidden /> Application Automation
            </p>
            <h2 className="mt-1 truncate font-serif text-xl font-semibold sm:text-2xl">
              {university?.name ?? "Apply to your university"}
            </h2>
            <p className="mt-0.5 truncate text-[13px] text-ink-faint">
              {university
                ? `${university.city}, ${university.country} · ${program ?? university.courseName}`
                : "Submit your verified application automatically"}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={phase === "running" || phase === "loading"}
            aria-label="Close"
            className="rounded-full p-2 text-ink-faint transition-colors hover:bg-white/10 hover:text-ink disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="px-6 py-6 sm:px-8 sm:py-7">
          <AnimatePresence mode="wait">
            {phase === "loading" && (
              <motion.div key="loading" {...fade} className="flex flex-col items-center gap-3 py-16 text-center">
                <Spinner label="Preparing your application…" />
              </motion.div>
            )}

            {phase === "gate" && (
              <motion.div key="gate" {...fade} className="space-y-6">
                <p className="text-[15px] leading-relaxed text-ink-soft">
                  I already have your scores, programme, and verified documents from earlier — I&apos;ll
                  fill the official application for you. This final step runs a quick readiness check,
                  then submits on your behalf.
                </p>

                {error && <DangerAlert title="Something went wrong">{error}</DangerAlert>}

                {/* one-time name confirm — only if VerifyFlow didn't already supply it */}
                {!nameReady && (
                  <Field
                    label="Your full name (as it appears on your documents)"
                    hint="Used to match your verified documents to this application."
                    error={nameTouched ? "Please add your name so we can pull the right documents." : undefined}
                    icon={<FileUp className="h-4 w-4" />}
                  >
                    <input
                      className={inputClass}
                      placeholder="e.g. Ananya Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                )}

                {/* readiness result */}
                {readiness && (
                  <AnalysisCard
                    title={readiness.eligible ? "You're ready to apply" : "A few things need attention first"}
                    foot={`Readiness checked for ${readiness.university_name}`}
                  >
                    {readiness.eligible ? (
                      <p className="text-[15px] leading-relaxed text-ink-soft">
                        All required documents are verified and your record meets the programme
                        requirements. I can submit this application automatically.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {readiness.eligibility_notes.length > 0 && (
                          <ul className="space-y-1.5 text-[15px] leading-relaxed text-ink-soft">
                            {readiness.eligibility_notes.map((n, i) => (
                              <li key={i} className="flex gap-2.5">
                                <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-amber" aria-hidden />
                                {n}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </AnalysisCard>
                )}

                {readiness && needsVerify && (
                  <Callout>
                    <span className="font-semibold">Before you can apply: </span>
                    complete document verification for {readiness.university_name}. Open{" "}
                    <span className="font-semibold">Verify documents</span> on the result card, pass the
                    check, and come back here — Apply Now will then be ready.
                  </Callout>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {/* Apply Now is always visible; enabled with a smooth animation when ready. */}
                  <motion.span
                    animate={
                      readiness?.eligible
                        ? { scale: [1, 1.04, 1], boxShadow: ["0 0 0px rgba(99,102,241,0)", "0 0 24px rgba(99,102,241,0.35)", "0 0 0px rgba(99,102,241,0)"] }
                        : { scale: 1 }
                    }
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="rounded-full inline-flex"
                  >
                    <Button
                      variant="primary"
                      onClick={() => {
                        if (!nameReady) {
                          setNameTouched(true);
                          return;
                        }
                        if (needsVerify) return;
                        void begin();
                      }}
                      disabled={!readiness?.eligible || busy || !universityId}
                      loading={busy && phase === "gate"}
                    >
                      <Send className="h-4 w-4" />
                      {busy && !application ? "Checking…" : needsVerify ? "Verify documents to apply" : "Apply now"}
                    </Button>
                  </motion.span>
                  {!readiness?.eligible && readiness && (
                    <span className="text-xs text-ink-faint">
                      Resolve the items above to enable Apply Now.
                    </span>
                  )}
                </div>

                {!readiness && (
                  <Hint>
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                    Apply Now activates automatically once your documents have been verified.
                  </Hint>
                )}
              </motion.div>
            )}

            {phase === "running" && (
              <motion.div key="running" {...fade} className="space-y-5">
                {/* premium progress */}
                <AnalysisCard
                  title={application?.status ?? "Working on your application"}
                  foot={
                    application
                      ? `${application.university_name} · ${Math.round(application.progress ?? 0)}% complete`
                      : "Connecting to the application portal…"
                  }
                >
                  {/* progress bar */}
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, #6366f1, #06b6d4)" }}
                      initial={{ width: "0%" }}
                      animate={{ width: `${Math.round(application?.progress ?? 0)}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>

                  {/* step rail */}
                  <ol className="mt-5 space-y-3">
                    {STAGES.map((s, i) => {
                      const done = stageIndex > i;
                      const active = stageIndex === i;
                      return (
                        <li key={s.status} className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border text-[11px] font-semibold ${
                              done
                                ? "border-green/40 bg-green-wash text-green"
                                : active
                                ? "border-blue/50 bg-blue-wash text-blue-deep"
                                : "border-line-strong text-ink-faint"
                            }`}
                          >
                            {done ? <BadgeCheck className="h-4 w-4" aria-hidden /> : active ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              i + 1
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold ${active ? "text-ink" : done ? "text-ink-soft" : "text-ink-faint"}`}>
                              {s.label}
                            </p>
                            {active && (
                              <motion.p
                                {...fade}
                                className="text-xs text-ink-faint"
                              >
                                {s.hint}
                              </motion.p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </AnalysisCard>

                {error && <DangerAlert title="Something went wrong">{error}</DangerAlert>}

                {/* paused — prompt the student for exactly what's missing */}
                {paused && (
                  <PausePanel
                    action={pending}
                    missingFields={application?.missing_fields ?? []}
                    answers={answers}
                    setAnswers={setAnswers}
                    busy={busy}
                    onSubmit={submitAction}
                  />
                )}

                {/* terminal success drives the success phase via effect below */}
              </motion.div>
            )}

            {phase === "success" && application && (
              <motion.div key="success" {...fade} className="space-y-5">
                <AnalysisCard
                  title="Application submitted"
                  foot={`${application.university_name} · ${program ?? ""}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="tag tag-green">
                      <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Submitted
                    </span>
                    {application.confirmation_id && (
                      <span className="tag tag-neutral">Ref {application.confirmation_id}</span>
                    )}
                    {application.simulated && (
                      <span className="tag tag-amber">Preview run</span>
                    )}
                  </div>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                    Your application has been submitted to {application.university_name}. The university
                    will review it and follow up — usually by email. You can close this window; I&apos;ve
                    saved a full record of what was sent.
                  </p>
                </AnalysisCard>

                <div className="flex flex-wrap gap-3">
                  <Button variant="primary" onClick={() => setPhase("inbox")}>
                    <Globe className="h-4 w-4" /> View inbox
                  </Button>
                  <Button variant="outline" onClick={onClose}>
                    Done
                  </Button>
                </div>
              </motion.div>
            )}

            {phase === "inbox" && application && (
              <motion.div key="inbox" {...fade} className="space-y-5">
                <AnalysisCard title="Application inbox" foot="Updates and messages about your applications">
                  <InboxList applicationId={application.application_id} />
                </AnalysisCard>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={onClose}>Done</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}

// ── pause panel ───────────────────────────────────────────────────────────────

function PausePanel({
  action,
  missingFields,
  answers,
  setAnswers,
  busy,
  onSubmit,
}: {
  action: ApplyPendingAction;
  missingFields: string[];
  answers: Record<string, string>;
  setAnswers: (fn: (p: Record<string, string>) => Record<string, string>) => void;
  busy: boolean;
  onSubmit: (action: ApplyPendingAction, payload?: Record<string, unknown>) => void;
}) {
  const isMissing =
    action === "missing_information" || action === "provide_missing_information" || action === "upload_failed";
  const allAnswered = missingFields.every((f) => (answers[f] ?? "").trim());

  return (
    <motion.div {...fade} className="well border border-amber/25 p-5">
      <p className="flex items-center gap-2 font-serif text-base font-semibold text-amber">
        <PauseCircle className="h-5 w-5" aria-hidden />
        {action === "captcha_required" && "Complete the verification shown above"}
        {action === "payment_required" && "Payment is required to continue"}
        {action === "submit_confirmation" && "Review and confirm submission"}
        {action === "otp_required" && "Enter the one-time code"}
        {isMissing && "A few details are missing"}
      </p>

      {action === "captcha_required" && (
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          The university&apos;s portal showed a verification challenge. Complete it directly, then
          continue — I&apos;ll pick up exactly where we paused.
        </p>
      )}
      {action === "payment_required" && (
        <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-ink-soft">
          <CreditCard className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
          This university charges an application fee. I never process payments automatically — confirm
          once you&apos;ve paid, and I&apos;ll resume the application immediately.
        </p>
      )}
      {action === "submit_confirmation" && (
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Everything is filled and your verified documents are attached. Confirm to submit — this is a
          one-time action.
        </p>
      )}
      {isMissing && (
        <div className="mt-3 space-y-3">
          <p className="text-sm leading-relaxed text-ink-soft">
            The portal needs the following for {`this`} application. I only ask for what isn&apos;t
            already in your verified record.
          </p>
          {missingFields.map((f) => (
            <Field key={f} label={labelForField(f)} icon={<FileUp className="h-4 w-4" />}>
              <input
                className={inputClass}
                placeholder={placeholderForField(f)}
                value={answers[f] ?? ""}
                onChange={(e) => setAnswers((p) => ({ ...p, [f]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {isMissing && (
          <Button
            variant="primary"
            disabled={!allAnswered || busy}
            loading={busy}
            onClick={() => onSubmit(action, answers)}
          >
            <Send className="h-4 w-4" /> Resume
          </Button>
        )}
        {action === "captcha_required" && (
          <Button variant="primary" disabled={busy} loading={busy} onClick={() => onSubmit("captcha_solved")}>
            <BadgeCheck className="h-4 w-4" /> I&apos;ve completed it
          </Button>
        )}
        {action === "payment_required" && (
          <Button variant="primary" disabled={busy} loading={busy} onClick={() => onSubmit("payment_completed")}>
            <CreditCard className="h-4 w-4" /> Payment completed
          </Button>
        )}
        {action === "submit_confirmation" && (
          <Button variant="primary" disabled={busy} loading={busy} onClick={() => onSubmit("submit_confirmed")}>
            <Send className="h-4 w-4" /> Submit application
          </Button>
        )}
        {action === "otp_required" && (
          <Button
            variant="primary"
            disabled={!(answers.otp ?? "").trim() || busy}
            loading={busy}
            onClick={() => onSubmit("otp_provided", { otp: answers.otp })}
          >
            <BadgeCheck className="h-4 w-4" /> Continue
          </Button>
        )}
        {action === "otp_required" && (
          <Field label="One-time code" className="flex-1 min-w-[160px]">
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder="123456"
              value={answers.otp ?? ""}
              onChange={(e) => setAnswers((p) => ({ ...p, otp: e.target.value }))}
            />
          </Field>
        )}
      </div>

      <p className="mt-3 flex items-center gap-2 text-xs text-ink-faint">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        Your session stays alive while I wait — nothing you&apos;ve entered is lost.
      </p>
    </motion.div>
  );
}

// ── inbox list ────────────────────────────────────────────────────────────────

function InboxList({ applicationId }: { applicationId: string }) {
  const [items, setItems] = useState<ApplyInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const app = await getApplyApplication(applicationId);
        if (cancelled) return;
        const inbox = await import("@/lib/apply").then((m) => m.listApplyInbox(app.student_id));
        if (!cancelled) setItems(inbox);
      } catch (e) {
        if (!cancelled) setErr(messageOf(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading your messages…
      </p>
    );
  }
  if (err) return <Callout>{err}</Callout>;
  if (!items.length) {
    return (
      <p className="text-sm leading-relaxed text-ink-soft">
        No messages yet. Universities usually email their decisions — anything they send through
        us will appear here.
      </p>
    );
  }
  return (
    <ul className="space-y-2.5">
      {items.map((m) => (
        <li
          key={m.id}
          className={`well flex items-start gap-3 rounded-2xl border p-4 ${
            m.category === "offer" ? "border-green/25" : m.category === "action_required" ? "border-amber/25" : "border-line"
          }`}
        >
          <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-blue-wash text-blue-deep">
            {m.category === "offer" ? <Sparkles className="h-5 w-5" aria-hidden /> : <Globe className="h-5 w-5" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{m.title}</p>
            <p className="mt-0.5 text-xs text-ink-faint">
              {m.university_name} · {new Date(m.updated_at).toLocaleString()}
              {m.read ? "" : " · Unread"}
            </p>
            {m.detail && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{m.detail}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-blue/30 border-t-blue-deep" />
      <p className="text-sm font-medium text-ink-soft">{label}</p>
    </div>
  );
}

function isTerminal(status: string) {
  return (
    status === "Completed" ||
    status === "Failed" ||
    status === "Rejected" ||
    status === "Accepted" ||
    status === "Offer Letter"
  );
}

/** Order index for the STAGES rail — Submitted/Under Review collapse into one rail position. */
function indexOfStatus(status: string): number {
  const direct = STAGES.findIndex((s) => s.status === status);
  if (direct >= 0) return direct;
  if (status === "Waiting for Student Action") return indexOfStatus("Filling Application");
  if (status === "Failed") return STAGES.length - 1;
  if (status === "Completed") return STAGES.length - 1;
  return 0;
}

function labelForField(field: string): string {
  return field
    .replace(/_+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w|\s\w/g, (c) => c.toUpperCase());
}

function placeholderForField(field: string): string {
  const lower = field.toLowerCase();
  if (lower.includes("phone") || lower.includes("mobile")) return "e.g. +91 98765 43210";
  if (lower.includes("email")) return "you@example.com";
  if (lower.includes("date")) return "YYYY-MM-DD";
  if (lower.includes("country") || lower.includes("nationality")) return "Country";
  return `Enter ${labelForField(field).toLowerCase()}`;
}

function messageOf(_e: unknown): string {
  return FRIENDLY_ERROR;
}

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: "easeOut" as const },
};
