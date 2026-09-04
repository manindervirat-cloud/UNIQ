/**
 * Verification payload builders — pure functions that turn University Agent state
 * into the inputs the embedded verify router expects.
 *
 * This is where "reuse every piece of info already collected, don't re-ask it"
 * lives for the Document Verification stage. The application-form cross-check
 * compares each uploaded document's OCR text against the student's OWN details
 * (name, grades, scores, school). The University Agent already holds all of that
 * in the profile, so we map it into the `applicant_record` the backend uses —
 * the student is never asked to re-type anything.
 *
 * Field naming follows the backend's `document_types.json` (e.g. a passport
 * cross-checks name/passport_number/nationality; a marksheet cross-checks
 * name/roll_number/board/percentage). We populate only what the profile actually
 * knows — a missing value simply isn't cross-checked, never invented.
 */

import type { StudentPayload, University } from "@/types/api";

/**
 * Build the applicant_record handed to POST /verify. Keys mirror the demo
 * application records the backend was built around, so the same cross-check
 * logic works unchanged against live profile data.
 *
 * The University Agent profile does not collect a first/last name, so `name`
 * is only set when one has been captured (see VerifyFlow's one-time name
 * confirm); everything else comes straight from the profile + selection.
 */
export function buildApplicantRecord(
  profile: StudentPayload,
  university: University | null,
  fullName: string | null
): Record<string, string> {
  const record: Record<string, string> = {};

  if (fullName && fullName.trim()) record.name = fullName.trim();

  // Academic record -> the fields marksheets/transcripts are cross-checked on.
  const gradeValue = (profile.gradingValue ?? "").trim();
  const gradingSystem = (profile.gradingSystem ?? "").trim().toLowerCase();
  if (gradeValue) {
    if (gradingSystem.includes("gpa") || gradingSystem.includes("cgpa")) {
      record.gpa = gradeValue;
    } else {
      // Percentage-style systems (Indian boards etc.).
      record.percentage = gradeValue;
    }
  }

  // Standardized / aptitude tests (SAT/GRE/GMAT…) -> transcript-adjacent checks.
  const aptitude = scoreList(profile.aptitudeTests);
  if (aptitude) record.test_scores = aptitude;

  // English proficiency -> the IELTS/TOEFL certificate cross-check.
  const english = firstEnglish(profile.englishTests);
  if (english) {
    record.test_type = english.name;
    record.score = english.score;
  }

  // Program context.
  const course = (university?.courseName || profile.targetCourse || "").trim();
  if (course) record.course_applied = course;
  const school = (university?.name || "").trim();
  if (school) record.school_name = school;

  const gradYear = deriveGraduationYear(profile.intakeSession);
  if (gradYear) record.graduation_year = gradYear;

  const backlogs = (profile.backlogs ?? "").trim();
  if (backlogs && backlogs !== "0") record.backlogs = backlogs;

  return record;
}

/** A stable student id for this session's verification call. The backend only
 * uses it as a label/registry key; the live record carries the real data. */
export function buildStudentId(fullName: string | null): string {
  const base = (fullName || "student")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `LIVE-${base || "student"}`;
}

// ── internals ────────────────────────────────────────────────────────────────

/** Renders a scores record as "GRE 320, SAT 1450", skipping zero/empty. */
function scoreList(scores: Record<string, number> | undefined): string {
  if (!scores) return "";
  return Object.entries(scores)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .map(([name, v]) => `${name} ${v}`)
    .join(", ");
}

/** Picks the first non-zero English test as {name, score} (e.g. "IELTS","7.5"). */
function firstEnglish(
  scores: Record<string, number> | undefined
): { name: string; score: string } | null {
  if (!scores) return null;
  for (const [name, v] of Object.entries(scores)) {
    if (typeof v === "number" && v > 0) return { name, score: String(v) };
  }
  return null;
}

/** intakeSession looks like "Fall 2026" / "Spring 2027" — pull the year out so a
 * transcript's graduation year can be sanity-checked. Returns null if no year. */
function deriveGraduationYear(intakeSession: string | undefined): string | null {
  if (!intakeSession) return null;
  const m = intakeSession.match(/(19|20)\d{2}/);
  return m ? m[0] : null;
}
