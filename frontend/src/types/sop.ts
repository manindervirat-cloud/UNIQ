/**
 * SOP module wire types.
 *
 * These mirror `src/backend/modules/sop/api/schemas.py` EXACTLY, using the
 * snake_case names the Pydantic models serialize to. The backend sets
 * `populate_by_name=True` on every request schema, so the same snake_case
 * names are accepted on the request side too — one shape for both directions.
 *
 * The backend is the single source of truth for this contract; this file is a
 * faithful mirror, not a redefinition. If the two ever disagree, the backend
 * wins and this file should be updated to match.
 *
 * Endpoints (all mounted under /api/v1/sop, proxied to the browser by the
 * Next.js /api rewrite — same origin, no CORS, no second service):
 *
 *   GET  /health        -> SopHealthResponse
 *   GET  /fields        -> SopFieldDefinition[]
 *   POST /requirements  -> SopCompletenessReport   (req: SopRequirementsRequest)
 *   POST /generate      -> SopGenerateResponse      (req: SopGenerateRequest)
 *   POST /revise        -> SopGenerateResponse      (req: SopReviseRequest)
 */

// ── Field registry (GET /fields) ───────────────────────────────────────────

export type SopImportance = "required" | "recommended" | "optional";

/**
 * FieldSpec.to_dict() — one row of the field registry returned by /fields.
 * Drives a dynamically-rendered form. Order matches the recommended interview
 * flow defined in services/completeness.py FIELD_REGISTRY.
 */
export interface SopFieldDefinition {
  key: string;
  label: string;
  question: string;
  importance: SopImportance;
  category: string;
  help_text: string;
  example: string;
  multiline: boolean;
}

// ── Student profile answers (the 13 narrative fields) ──────────────────────

/**
 * StudentProfile — 13 optional narrative fields. Every field may be null when
 * the University Agent hands over a partially-known student; the /requirements
 * endpoint reports which nulls still need filling.
 *
 * Field order mirrors the backend registry: full_name, current_education,
 * academic_achievements, why_this_field, why_this_university,
 * work_experience, research_or_projects, extracurriculars, challenges_overcome,
 * unique_strengths, career_goals_short_term, career_goals_long_term,
 * anything_else.
 */
export interface SopStudentProfile {
  full_name: string | null;
  current_education: string | null;
  academic_achievements: string | null;
  why_this_field: string | null;
  why_this_university: string | null;
  work_experience: string | null;
  research_or_projects: string | null;
  extracurriculars: string | null;
  challenges_overcome: string | null;
  unique_strengths: string | null;
  career_goals_short_term: string | null;
  career_goals_long_term: string | null;
  anything_else: string | null;
  [key: string]: string | null;
}

// ── University target ──────────────────────────────────────────────────────

/**
 * UniversityTarget — the program the SOP is for. university_name and
 * course_name are the only hard requirements (min_length 1); the rest may be
 * null. target_word_count, when set, must be between 100 and 5000.
 */
export interface SopUniversityTarget {
  university_name: string;
  course_name: string;
  country: string | null;
  degree_level: string | null;
  target_word_count: number | null;
  specific_prompt: string | null;
}

// ── Generation options ─────────────────────────────────────────────────────

/**
 * GenerationOptions. `research` null = use the backend's global default;
 * false = skip live web research for this call (faster, no scraping).
 * `allow_ai` true = use the LLM when a key is configured, else the backend
 * degrades to its template engine and reports generated_with_ai=false.
 */
export interface SopGenerationOptions {
  research: boolean | null;
  allow_ai: boolean;
}

// ── Request bodies ─────────────────────────────────────────────────────────

export interface SopRequirementsRequest {
  answers: SopStudentProfile;
  target: SopUniversityTarget | null;
  include_optional_questions: boolean;
}

export interface SopGenerateRequest {
  target: SopUniversityTarget;
  answers: SopStudentProfile;
  options: SopGenerationOptions | null;
  insights: Record<string, unknown> | null;
}

export interface SopReviseRequest {
  sop_text: string;
  key_points: string[];
  feedback: string;
  target: SopUniversityTarget | null;
  options: SopGenerationOptions | null;
}

// ── Completeness + next_questions (POST /requirements) ─────────────────────

export type SopFieldStatus = "provided" | "weak" | "missing";

/**
 * FieldState.to_dict() — one entry of CompletenessReport.next_questions.
 * Same shape as SopFieldDefinition plus a `status`. Within next_questions the
 * status is always "missing" (analyze() only includes MISSING fields there),
 * but the field is present on the wire so it is typed.
 *
 * next_questions is ordered REQUIRED -> RECOMMENDED -> OPTIONAL, registry
 * order within each tier, and (unless include_optional_questions) only
 * contains REQUIRED + RECOMMENDED.
 */
export interface SopNextQuestion extends SopFieldDefinition {
  status: SopFieldStatus;
}

export interface SopCompletenessReport {
  can_generate: boolean;
  is_ready: boolean;
  readiness_score: number;
  readiness_label: string;
  blocking_reasons: string[];
  missing_required: string[];
  missing_recommended: string[];
  missing_optional: string[];
  weak_fields: string[];
  provided_fields: string[];
  next_questions: SopNextQuestion[];
}

// ── Adaptive interview (POST /interview/start, POST /interview/followup) ────

/**
 * One question from the adaptive plan. Extends the registry row with the
 * structured-UI contract from services/interview.py QUESTION_UIS:
 *   ui        -> which control renders (select/multi-select/text)
 *   options   -> choices for select UIs (always include an "Other"-style entry)
 *   why       -> one-line motivation shown under the question
 *   skippable -> non-required questions can be skipped
 */
export interface SopQuestion extends SopFieldDefinition {
  status?: SopFieldStatus;
  ui?: "short_text" | "long_text" | "single_select" | "multi_select" | "optional_long_text";
  options?: string[];
  why?: string;
  skippable?: boolean;
}

/** A field the engine already knows — shown as "✓ Already available", never asked. */
export interface SopKnownField {
  key: string;
  label: string;
  status: "provided" | "weak";
}

export interface SopWeakField {
  key: string;
  hint: string;
}

/**
 * InterviewPlan — response of POST /interview/start. `questions` is emergent
 * (only genuinely-missing, value-ranked fields); `known` drives the
 * pre-filled profile panel; there is no fixed question count.
 */
export interface SopInterviewPlan {
  known: SopKnownField[];
  questions: SopQuestion[];
  weak_fields: SopWeakField[];
  readiness_score: number;
  readiness_label: string;
  can_generate: boolean;
  blocking_reasons: string[];
}

export interface SopInterviewStartRequest {
  answers: SopStudentProfile;
  target: SopUniversityTarget | null;
  include_optional?: boolean;
}

/** A single adaptive follow-up generated from what an answer actually said. */
export interface SopFollowUp {
  key: string;
  question: string;
  ui?: string;
  options?: string[];
  why?: string;
  skippable?: boolean;
}

export interface SopFollowUpRequest {
  answers: SopStudentProfile;
  key: string;
  answer: string;
}

export interface SopFollowUpResponse {
  follow_up: SopFollowUp | null;
}

// ── Quality report (inside GenerateResponse) ───────────────────────────────

export interface SopQualityReport {
  word_count: number;
  paragraph_count: number;
  cliches: string[];
  cliche_count: number;
  placeholder_count: number;
  target_word_count: number | null;
  within_target: boolean | null;
  delta_words: number | null;
  length_verdict: string;
}

// ── Generate / Revise response ─────────────────────────────────────────────

/**
 * GenerateResponse — returned by both /generate and /revise. `generated_with_ai`
 * distinguishes the LLM path from the template fallback. `completeness` is
 * present on /generate, null on /revise. `change_note` summarises a revision.
 */
export interface SopGenerateResponse {
  sop_text: string;
  key_points: string[];
  word_count: number;
  paragraph_count: number;
  generated_with_ai: boolean;
  disclaimer: string;
  quality: SopQualityReport;
  completeness: SopCompletenessReport | null;
  word_target: number | null;
  model: string | null;
  warnings: string[];
  /**
   * Structured web-research verification state from the backend. The UI maps
   * this to a clean status message; raw failure reasons never reach the client.
   */
  research_status:
    | "verified"
    | "partial"
    | "unavailable"
    | "failed"
    | "timeout"
    | "no_results"
    | "disabled"
    | "skipped"
    | "not_run";
  change_note: string | null;
}

// ── Health (GET /health) ───────────────────────────────────────────────────

export interface SopHealthResponse {
  status: string;
  ai_enabled: boolean;
  research_enabled: boolean;
  environment: string;
}

// ── Error envelope (structured SOP errors: 404 / 429) ──────────────────────

export interface SopErrorDetail {
  code: string;
  message: string;
  details: Record<string, unknown>[] | null;
}

export interface SopErrorResponse {
  error: SopErrorDetail;
  request_id: string | null;
}
