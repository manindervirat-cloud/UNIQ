/**
 * SOP payload builders — pure functions that turn University Agent state into
 * the snake_case request bodies the embedded SOP router expects.
 *
 * This is where "reuse every piece of info already collected, don't re-ask it"
 * lives. The University Agent already knows the student's grade, English and
 * aptitude scores, target course, degree, and the selected university. We map
 * that into the SOP wire shapes so the /requirements check only reports the
 * genuinely-missing narrative fields.
 *
 * Rules (matching the SOP backend's own anti-fabrication stance — blank fields
 * become [bracketed placeholders], never invented facts):
 *  - Only fields whose value we actually HAVE are prefilled.
 *  - Narrative fields that require the student's personal voice
 *    (why_this_field, why_this_university, career goals, etc.) are left null so
 *    the stepper asks for them — we never fabricate motivation from university
 *    marketing copy.
 *  - full_name is null because the University Agent profile collects no name;
 *    the stepper asks for it (asking for info that does NOT yet exist is
 *    correct, not a re-ask).
 */

import type { StudentPayload, University } from "@/types/api";
import type {
  SopGenerationOptions,
  SopStudentProfile,
  SopUniversityTarget,
} from "@/types/sop";

/**
 * Build the university target for an SOP from a result card's university plus
 * the student's profile. university_name and course_name are the only
 * hard-required fields (min_length 1) and both come from the university the
 * student clicked "Generate SOP" on.
 */
export function buildSopTarget(
  u: University,
  profile: StudentPayload
): SopUniversityTarget {
  return {
    university_name: u.name,
    // u.courseName is the program at this university; fall back to the
    // student's search course only as a defensive guard (a result card always
    // carries a courseName).
    course_name: u.courseName || profile.targetCourse || "",
    country: u.country || null,
    // The program's degree level is the relevant one for a targeted SOP; fall
    // back to the student's target degree if the record omits it.
    degree_level: u.degreeLevel || profile.degreeLevel || null,
    // null => the backend uses its configured default (default_word_target,
    // 1000 — the midpoint of the standard 800–1200 SOP range).
    target_word_count: null,
    specific_prompt: null,
  };
}

/**
 * Build the student-profile answers for an SOP, reusing everything the
 * University Agent already collected.
 *
 * Prefilled from the profile (never re-asked by the interview):
 *  - current_education     <- degree level + academic record + backlogs
 *  - work_experience       <- workExperienceYears
 *  - academic_achievements <- grade, English scores, aptitude scores, backlogs
 *
 * Everything else is a personal-narrative field the profile doesn't capture,
 * so it is left null and the adaptive interview asks for just the gaps.
 */
export function buildSopAnswers(profile: StudentPayload): SopStudentProfile {
  return {
    full_name: null,
    current_education: buildCurrentEducation(profile),
    academic_achievements: buildAcademicRecord(profile),
    why_this_field: null,
    why_this_university: null,
    work_experience: buildWorkExperience(profile),
    research_or_projects: null,
    extracurriculars: null,
    challenges_overcome: null,
    unique_strengths: null,
    career_goals_short_term: null,
    career_goals_long_term: null,
    anything_else: null,
  };
}

/**
 * Default generation options. `research` is off by default so a click doesn't
 * trigger slow live web scraping; the UI exposes a toggle for students who
 * want the research-enriched draft. `allow_ai` stays true so the backend uses
 * the LLM when a key is configured and otherwise degrades to its template
 * engine (reported back via generated_with_ai).
 */
export function sopOptions(research: boolean): SopGenerationOptions {
  return { research, allow_ai: true };
}

// ── internals ──────────────────────────────────────────────────────────────

/**
 * Factual education line from the profile's degree level + grade + backlogs.
 * Returns null when the profile holds nothing usable, so the interview asks
 * for it instead of inventing facts (anti-fabrication rule).
 */
function buildCurrentEducation(profile: StudentPayload): string | null {
  const parts: string[] = [];
  const degree = (profile.degreeLevel ?? "").trim();
  if (degree) parts.push(`Current degree level: ${degree}.`);
  const grade = [profile.gradingSystem, profile.gradingValue]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (grade) parts.push(`Academic record: ${grade}.`);
  const backlogs = (profile.backlogs ?? "").trim();
  if (backlogs && backlogs !== "0") parts.push(`Backlogs: ${backlogs}.`);
  return parts.length ? parts.join(" ") : null;
}

/**
 * Work-experience line from the profile's years field. "0" or blank -> null
 * (no fabricated experience; the interview simply won't claim any).
 */
function buildWorkExperience(profile: StudentPayload): string | null {
  const years = Number.parseFloat((profile.workExperienceYears ?? "").trim());
  if (!Number.isFinite(years) || years <= 0) return null;
  return `About ${years} year${years === 1 ? "" : "s"} of work experience.`;
}

/**
 * Assembles a compact academic-record string from the quantitative facts the
 * profile already holds. Returns null when there is nothing usable, so the
 * field stays "missing" and the stepper can ask for it.
 */
function buildAcademicRecord(profile: StudentPayload): string | null {
  const parts: string[] = [];

  const grade = [profile.gradingSystem, profile.gradingValue]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (grade) parts.push(`Academic record: ${grade}.`);

  const english = scoreList(profile.englishTests);
  if (english) parts.push(`English proficiency: ${english}.`);

  // aptitudeTests is the live store (Record<string, number>) written by the
  // profile wizard's TestListEditor. The legacy satScore/greScore/etc string
  // fields are never populated by the current UI, so they are intentionally
  // not read here.
  const aptitude = scoreList(profile.aptitudeTests);
  if (aptitude) parts.push(`Standardized tests: ${aptitude}.`);

  const backlogs = (profile.backlogs ?? "").trim();
  if (backlogs && backlogs !== "0") parts.push(`Backlogs: ${backlogs}.`);

  return parts.length ? parts.join(" ") : null;
}

/** Renders a scores record as "IELTS 7.5, TOEFL 105", skipping zero/empty. */
function scoreList(scores: Record<string, number> | undefined): string {
  if (!scores) return "";
  return Object.entries(scores)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([name, v]) => `${name} ${v}`)
    .join(", ");
}
