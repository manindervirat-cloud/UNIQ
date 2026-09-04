"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  Check,
  GraduationCap,
  Home,
  MapPin,
  RefreshCw,
  Target,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { Hint } from "@/components/ui/Panels";
import { CourseAutocomplete } from "@/components/profile/CourseAutocomplete";
import { TestListEditor } from "@/components/profile/TestListEditor";
import { SearchSelect } from "@/components/ui/SearchSelect";
import type { StudentPayload } from "@/types/api";

/**
 * The profile is now a four-step guided wizard — one topic per screen,
 * per-step validation, a visible progress rail, and every answer saved
 * as it's typed. Structurally different from the old single long form.
 */

const STEPS = ["Studies", "Money & grades", "Destination", "Tests & goals"] as const;

export function ProfileWizard() {
  const router = useRouter();
  const { profile, update, hydrated } = useProfile();
  const [step, setStep] = useState(0);
  const [touched, setTouched] = useState(false);
  const {
    data: meta,
    isLoading: metaLoading,
    isError: metaError,
    error: metaErrorData,
    refetch: refetchMeta,
  } = useQuery({
    queryKey: ["meta"],
    queryFn: api.meta,
    retry: 2,
    retryDelay: 1000,
  });

  // Live domain validation for the fields on screen.
  const { data: live } = useQuery({
    // dependency keys for the validate query
    // eslint-disable-next-line react-hooks/exhaustive-deps
    queryKey: [
      "validate",
      profile.budgetText,
      profile.homeCountry,
      profile.gradingSystem,
      profile.gradingValue,
      profile.preferredCity,
      profile.targetCourse,
    ],
    queryFn: () =>
      api.validate({
        budgetText: profile.budgetText,
        homeCountry: profile.homeCountry,
        gradingSystem: profile.gradingSystem,
        gradingValue: profile.gradingValue,
        preferredCity: profile.preferredCity,
        targetCourse: profile.targetCourse,
      }),
    enabled:
      Boolean(meta) &&
      Boolean(
        profile.budgetText || profile.gradingValue || profile.preferredCity || profile.targetCourse
      ),
    staleTime: 800,
  });

  useEffect(() => setTouched(false), [step]);

  const [showSlowMessage, setShowSlowMessage] = useState(false);
  useEffect(() => {
    if (!metaLoading) {
      setShowSlowMessage(false);
      return;
    }
    const id = setTimeout(() => setShowSlowMessage(true), 3000);
    return () => clearTimeout(id);
  }, [metaLoading]);

  const cityOptions = useMemo(() => {
    if (!meta) return [];
    const selected = profile.preferredCountries.length ? profile.preferredCountries : meta.countries;
    return Array.from(new Set(selected.flatMap((c) => meta.citiesByCountry[c] ?? []))).sort();
  }, [meta, profile.preferredCountries]);

  if (metaError) {
    const message =
      metaErrorData instanceof Error
        ? metaErrorData.message
        : "Could not connect to the backend API.";
    return (
      <div className="panel p-6 sm:p-8">
        <h2 className="font-serif text-2xl font-semibold">Connection problem</h2>
        <p className="mt-2 text-sm text-ink-soft">
          The frontend cannot reach the backend. Please make sure the FastAPI server is running at{" "}
          <code className="rounded bg-surface px-1 py-0.5 text-ink">http://127.0.0.1:8000</code> and that
          you have copied <code className="rounded bg-surface px-1 py-0.5 text-ink">.env.example</code> to{" "}
          <code className="rounded bg-surface px-1 py-0.5 text-ink">.env</code>.
        </p>
        <p className="mt-3 rounded-xl bg-amber-wash px-4 py-3 text-sm font-medium text-amber">
          {message}
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="primary" onClick={() => refetchMeta()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!meta || !hydrated) {
    return (
      <div className="panel p-6 sm:p-8">
        <div className="skeleton h-[560px]" aria-label="Loading your options" />
        {showSlowMessage && (
          <p className="mt-4 text-sm text-ink-soft">
            Still loading your options... Make sure the backend is running at{" "}
            <code className="rounded bg-surface px-1 py-0.5 text-ink">http://127.0.0.1:8000</code> and that
            the Next.js dev server was restarted after creating{" "}
            <code className="rounded bg-surface px-1 py-0.5 text-ink">.env</code>.
          </p>
        )}
      </div>
    );
  }

  const aptitude = meta.aptitudeByDegree[profile.degreeLevel] ?? [];

  // ---- per-step validation ----
  const stepErrors: string[] = [];
  if (step === 0) {
    if (!profile.targetCourse) stepErrors.push("Choose your course");
    if (!profile.degreeLevel) stepErrors.push("Choose a degree level");
    if (!profile.intakeSession) stepErrors.push("Pick a target intake");
  }
  if (step === 1) {
    if (!profile.homeCountry) stepErrors.push("Pick your home country");
    if (!profile.budgetText || (live && !live.budget.ok)) stepErrors.push("Enter a valid yearly budget");
    if (!profile.gradingSystem || !profile.gradingValue || (live && !live.academic.ok))
      stepErrors.push("Enter a valid academic score");
  }

  const next = () => {
    if (stepErrors.length) {
      setTouched(true);
      return;
    }
    if (step < STEPS.length - 1) setStep(step + 1);
    else router.push("/results");
  };

  return (
    <section className="panel">
      {/* progress rail — clips its own corners; the panel must NOT use
          overflow-hidden or open dropdowns get cut off at the card edge */}
      <ol className="flex overflow-hidden rounded-t-2xl border-b border-line bg-white/5" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`w-full px-2 py-3.5 text-center text-xs font-bold transition-colors sm:text-[13px] ${
                i === step
                  ? "border-b-2 border-blue text-blue-deep"
                  : i < step
                    ? "text-green"
                    : "text-ink-faint"
              }`}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? <Check className="mx-auto h-4 w-4" aria-label={`${s} (done)`} /> : `${i + 1}. ${s}`}
            </button>
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -14 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="space-y-5 p-6 sm:p-8"
        >
          {step === 0 && (
            <>
              <WizardHeading title="What do you want to study?" sub="Course, level and when you'd like to begin." />
              <Field label="Target course" icon={<BookOpen className="h-3.5 w-3.5" />}>
                <CourseAutocomplete
                  meta={meta}
                  value={profile.targetCourse}
                  onChange={(c) => update({ targetCourse: c })}
                />
              </Field>
              {live?.course?.note && <Hint>{live.course.note}</Hint>}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Degree level" icon={<GraduationCap className="h-3.5 w-3.5" />}>
                  <SearchSelect
                    value={profile.degreeLevel}
                    onChange={(v) => update({ degreeLevel: v })}
                    options={meta.degreeLevels}
                    placeholder="Bachelor's, Master's or PhD"
                  />
                </Field>
                <Field label="Target intake" icon={<Calendar className="h-3.5 w-3.5" />}>
                  <SearchSelect
                    value={profile.intakeSession}
                    onChange={(v) => update({ intakeSession: v })}
                    options={meta.intakes}
                    placeholder="When do you want to start?"
                  />
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <WizardHeading title="Money and grades" sub="We convert everything for you — write it the way you'd say it." />
              <Field label="Home country (for fee conversion)" icon={<Home className="h-3.5 w-3.5" />}>
                <SearchSelect
                  value={profile.homeCountry}
                  onChange={(v) => update({ homeCountry: v })}
                  options={meta.homeCountries}
                  placeholder="Where are you applying from?"
                />
              </Field>
              <Field
                label="Yearly budget"
                icon={<Wallet className="h-3.5 w-3.5" />}
                hint={live?.budget.ok ? `Understood as ${live.budget.note}` : undefined}
                error={profile.budgetText && live && !live.budget.ok ? live.budget.error : undefined}
              >
                <input
                  className={inputClass}
                  placeholder="e.g. 20 lakh · USD 50,000 · $60k"
                  value={profile.budgetText}
                  onChange={(e) => update({ budgetText: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Grading system">
                  <SearchSelect
                    value={profile.gradingSystem}
                    onChange={(v) => update({ gradingSystem: v })}
                    options={meta.gradingSystems}
                    placeholder="Percentage, CGPA or GPA?"
                  />
                </Field>
                <Field
                  label="Your score"
                  hint={live?.academic.ok ? `Understood as ${live.academic.display}` : undefined}
                  error={profile.gradingValue && live && !live.academic.ok ? live.academic.error : undefined}
                >
                  <input
                    className={inputClass}
                    placeholder="e.g. 78 / 8.5 / 3.4"
                    value={profile.gradingValue}
                    onChange={(e) => update({ gradingValue: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Work experience (years)">
                  <input
                    className={inputClass}
                    placeholder="0 if none"
                    value={profile.workExperienceYears}
                    onChange={(e) => update({ workExperienceYears: e.target.value })}
                  />
                </Field>
                <Field label="Backlogs (if any)">
                  <input
                    className={inputClass}
                    placeholder="e.g. 0"
                    value={profile.backlogs}
                    onChange={(e) => update({ backlogs: e.target.value })}
                  />
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <WizardHeading title="Where would you like to go?" sub="Leave countries empty to search all ten destinations." />
              <Field label="Preferred destinations" icon={<MapPin className="h-3.5 w-3.5" />}>
                <div className="flex flex-wrap gap-2">
                  {meta.countries.map((c) => {
                    const active = profile.preferredCountries.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          update({
                            preferredCountries: active
                              ? profile.preferredCountries.filter((x) => x !== c)
                              : [...profile.preferredCountries, c],
                          })
                        }
                        className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                          active
                            ? "border-blue bg-blue text-white"
                            : "border-line-strong bg-white/5 text-ink-soft hover:border-blue hover:text-blue-deep"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Preferred city (optional)">
                <input
                  className={inputClass}
                  list="city-options"
                  placeholder="Any city — type to search, e.g. Hayward"
                  value={profile.preferredCity}
                  onChange={(e) => update({ preferredCity: e.target.value })}
                />
                <datalist id="city-options">
                  {cityOptions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              {live?.city.note && <Hint>{live.city.note}</Hint>}
              {live?.city.resolvedCity && !live.city.note && !live.city.hasUniversities && (
                <Hint>
                  No universities are currently listed in {live.city.resolvedCity}. Try a nearby
                  city or continue without a city preference.
                </Hint>
              )}
              <label className="flex items-center gap-2.5 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[#1d4ed8]"
                  checked={profile.wantsScholarship}
                  onChange={(e) => update({ wantsScholarship: e.target.checked })}
                />
                Scholarships are a priority for me
              </label>
            </>
          )}

          {step === 3 && (
            <>
              <WizardHeading title="Tests and goals" sub="Add every test you've taken — we automatically use your strongest valid score." />
              <TestListEditor
                label="English language tests"
                addLabel="Add an English test"
                specs={Object.fromEntries(
                  Object.entries(meta.englishTestRanges).map(([k, v]) => [k, { ...v }])
                )}
                value={profile.englishTests}
                onChange={(next) => update({ englishTests: next })}
              />
              <TestListEditor
                label={`Aptitude & admission tests (optional${
                  profile.degreeLevel && aptitude.length
                    ? ` — typically ${aptitude.join("/")} for ${profile.degreeLevel}`
                    : ""
                })`}
                addLabel="Add an aptitude test"
                specs={Object.fromEntries(
                  Object.entries(meta.aptitudeTests).map(([k, v]) => [
                    k,
                    { min: v.min, max: v.max, step: v.step, hint: v.hint, extra: `Typically for: ${v.for}` },
                  ])
                )}
                value={profile.aptitudeTests ?? {}}
                onChange={(next) => update({ aptitudeTests: next })}
              />
              <Field label="What matters most to you?" icon={<Target className="h-3.5 w-3.5" />}>
                <SearchSelect
                  value={profile.priorityFocus}
                  onChange={(v) => update({ priorityFocus: v })}
                  options={meta.priorities}
                  placeholder="Pick a priority"
                />
              </Field>
              <Field label="Anything else? (optional)">
                <textarea
                  className={`${inputClass} min-h-[84px]`}
                  placeholder="e.g. strong co-op culture, a large Indian student community…"
                  value={profile.priorityNote}
                  onChange={(e) => update({ priorityNote: e.target.value })}
                />
              </Field>
              {Object.keys(profile.englishTests).length > 0 ? (
                <p className="rounded-xl border border-green/25 bg-green-wash px-4 py-3 text-sm text-green">
                  ✓ English proof on file:{" "}
                  {Object.entries(profile.englishTests)
                    .map(([t, s]) => `${t} ${s}`)
                    .join(" · ")}{" "}
                  — your strongest score is used automatically.
                </p>
              ) : (
                <p className="rounded-xl border border-amber/25 bg-amber-wash px-4 py-3 text-sm text-amber">
                  ⚠ No English test saved yet. Universities require proof of English — without a
                  score, eligibility can&apos;t be determined and results are ranked cautiously.
                </p>
              )}
            </>
          )}

          {touched && stepErrors.length > 0 && (
            <div className="rounded-xl bg-amber-wash px-4 py-3 text-sm font-medium text-amber">
              Before continuing: {stepErrors.join(" · ")}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-line pt-5">
            <Button variant="link" disabled={step === 0} onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button variant="primary" onClick={next}>
              {step === STEPS.length - 1 ? "Show my matches" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function WizardHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <header>
      <h2 className="font-serif text-2xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{sub}</p>
    </header>
  );
}
