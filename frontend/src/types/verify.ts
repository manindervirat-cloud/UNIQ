/**
 * Document Verification module wire types.
 *
 * These mirror the embedded verify router (`src/backend/modules/verify/api/routers/verify.py`)
 * and the pipeline orchestrator's output exactly, using the snake_case names the
 * backend serializes. The backend is the single source of truth for this contract;
 * this file is a faithful mirror. If the two ever disagree, the backend wins.
 *
 * Endpoints (all mounted under /api/v1/verify, proxied to the browser by the
 * Next.js /api rewrite — same origin, no CORS, no second service):
 *
 *   GET  /health         -> VerifyHealthResponse
 *   GET  /universities   -> VerifyUniversity[]
 *   GET  /applications   -> VerifyApplicationOption[]   (demo fallback picker)
 *   POST /verify         -> VerifyReport                 (multipart form)
 */

// ── Health (GET /health) ─────────────────────────────────────────────────────

export interface VerifyHealthResponse {
  status: string;
  ai_enabled: boolean;
  environment: string;
}

// ── Universities + document checklist (GET /universities) ───────────────────

export interface VerifyRequiredDocument {
  doc_type: string;
  label: string;
}

export interface VerifyUniversity {
  id: string;
  name: string;
  country: string;
  location: string;
  registry_name: string;
  required_documents: VerifyRequiredDocument[];
}

// ── Demo applicants (GET /applications, fallback only) ──────────────────────

export interface VerifyApplicationOption {
  student_id: string;
  name: string;
  university_id: string;
  course_applied: string;
}

// ── Pipeline steps (inside VerifyDocumentResult) ────────────────────────────

/** One pipeline step's output. Shape varies per step; only common keys are typed. */
export interface VerifyStep {
  step: string;
  flags: string[];
  suspicious?: boolean;
  duration_ms?: number;
  [key: string]: unknown;
}

// ── Per-document result ──────────────────────────────────────────────────────

export type VerifyVerdict = "VERIFIED" | "FLAGGED" | "REJECTED" | "INCOMPLETE";

export interface VerifyDocumentResult {
  doc_type: string;
  doc_label: string;
  trust_score: number;
  verdict: VerifyVerdict;
  verdict_label: string;
  steps: VerifyStep[];
  flags: string[];
  student_alerts: string[];
  duration_ms: number;
}

// ── Overall report (POST /verify) ────────────────────────────────────────────

export interface VerifyReport {
  student_id: string;
  university_id: string;
  university_name: string;
  university_country: string;
  registry_name: string;
  overall_trust_score: number;
  overall_verdict: VerifyVerdict;
  overall_verdict_label: string;
  missing_documents: string[];
  documents: VerifyDocumentResult[];
  student_alerts: string[];
  total_duration_ms: number;
}
