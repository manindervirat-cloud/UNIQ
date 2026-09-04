/**
 * Application Automation (Agent 4) types.
 *
 * Mirrors the embedded apply router's payloads exactly. Status values are
 * human-readable strings (the backend ApplicationStatus enum serialises to its
 * value, e.g. "Filling Application"); the numeric `progress` is authoritative
 * for the progress bar, and `status`/`pending_student_action` drive which
 * prompt (if any) the overlay renders.
 */

// ---------------------------------------------------------------------------
// Readiness (the Apply-Now gate)
// ---------------------------------------------------------------------------
export interface ApplyReadiness {
  eligible: boolean;
  university_name: string;
  program: string | null;
  missing_documents: string[];
  missing_fields: string[];
  eligibility_notes: string[];
  document_notes: string[];
}

// ---------------------------------------------------------------------------
// Lifecycle status (backend ApplicationStatus values + progress map)
// ---------------------------------------------------------------------------
export type ApplyStatus =
  | "Preparing Application"
  | "Checking Eligibility"
  | "Checking Documents"
  | "Ready to Apply"
  | "Application Started"
  | "Filling Application"
  | "Uploading Documents"
  | "Waiting for Student Action"
  | "Submitted"
  | "Under Review"
  | "Additional Documents Requested"
  | "Interview Requested"
  | "Conditional Offer"
  | "Offer Letter"
  | "Accepted"
  | "Rejected"
  | "Completed"
  | "Failed";

/** The pause kinds the orchestrator can surface via pending_student_action. */
export type ApplyPendingAction =
  | "missing_information"
  | "provide_missing_information"
  | "upload_failed"
  | "captcha_required"
  | "payment_required"
  | "submit_confirmation"
  | "otp_required"
  | string;

export interface ApplyHistoryEntry {
  status: ApplyStatus;
  at: string;
  detail: string | null;
  simulated: boolean;
}

export interface ApplyAutomationSummary {
  success: boolean;
  filled_fields: { canonical_field: string; selector: string | null; confidence: number }[];
  uploaded_documents: string[];
  validation_errors: string[];
  needs_student_action: boolean;
  student_action_reason: ApplyPendingAction | null;
  submitted: boolean;
  confirmation_id: string | null;
  simulated: boolean;
}

// ---------------------------------------------------------------------------
// The live application record polled during the run
// ---------------------------------------------------------------------------
export interface ApplyApplication {
  student_id: string;
  university_id: string;
  university_name: string;
  application_id: string;
  program: string | null;
  status: ApplyStatus;
  simulated: boolean;
  created_at: string;
  updated_at: string;
  history: ApplyHistoryEntry[];
  readiness: ApplyReadiness | null;
  automation: ApplyAutomationSummary | null;
  confirmation_id: string | null;
  pending_student_action: ApplyPendingAction | null;
  missing_fields: string[];
  progress: number;
}

// ---------------------------------------------------------------------------
// Request/response envelopes
// ---------------------------------------------------------------------------
export interface ApplyStartedResponse {
  application_id: string;
  task_id: string;
}

export interface ApplyResumeResponse {
  application_id: string;
  task_id: string;
}

export interface ApplyStudentAction {
  /** The gate being resolved (e.g. "captcha_solved", "payment_completed",
   *  "submit_confirmed", or a missing-info answer). */
  action: string;
  /** Missing-field answers, when the gate is an information request. */
  payload?: Record<string, unknown>;
}

export interface ApplyAuditEntry {
  application_id: string;
  event: string;
  detail?: string | null;
  at?: string;
  level?: string;
}

// ---------------------------------------------------------------------------
// Inbox
// ---------------------------------------------------------------------------
export type ApplyInboxCategory =
  | "offer"
  | "acceptance"
  | "rejection"
  | "status_update"
  | "document_request"
  | "action_required"
  | "interview";

export interface ApplyInboxItem {
  id: string;
  student_id: string;
  university_id: string;
  university_name: string;
  program: string | null;
  status: ApplyStatus;
  category: ApplyInboxCategory;
  simulated: boolean;
  updated_at: string;
  created_at: string;
  confirmation_id: string | null;
  pending_student_action: ApplyPendingAction | null;
  progress: number;
  title: string;
  detail: string | null;
  read: boolean;
}
