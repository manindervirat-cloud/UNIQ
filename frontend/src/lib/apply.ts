/**
 * Application Automation (Agent 4) frontend client.
 *
 * Thin fetch wrappers over the embedded /api/v1/apply router plus payload
 * builders and deterministic-id helpers the UI needs to re-ask as little as
 * possible. Mirrors the shape of lib/verify.ts: pure helpers for the data the
 * platform already knows, typed HTTP for the live calls.
 *
 * Backend endpoints consumed (all prefixed with /api/v1/apply):
 *   GET  /health
 *   GET  /readiness/{student_id}/{university_id}
 *   POST /apply                                  -> 202 {application_id, task_id}
 *   GET  /applications/{application_id}
 *   POST /applications/{application_id}/resume   -> 202
 *   GET  /applications/{application_id}/audit
 *   GET  /inbox/{student_id}
 *   GET  /applications/{application_id}/inbox
 *   GET  /tasks/{task_id}
 *
 * The student never re-types anything the University Agent already collected.
 * buildApplyStudentId keeps the identity auxiliary services use, derived from
 * the student's name; the actual profile/documents are looked up server-side
 * by the module's live adapters via that id.
 */

import type { University } from "@/types/api";
import type {
  ApplyReadiness,
  ApplyApplication,
  ApplyStartedResponse,
  ApplyResumeResponse,
  ApplyAuditEntry,
  ApplyInboxItem,
  ApplyStudentAction,
} from "@/types/apply";

const APPLY_BASE =
  process.env.NEXT_PUBLIC_APPLY_URL || "http://localhost:8000/api/v1/apply";

/** Small fetch helper; same pattern as verify.ts apiRequest. */
async function applyRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${APPLY_BASE}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data && (data.detail || data.message)) || `Request failed (${res.status})`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Identity helpers (no re-asking)
// ---------------------------------------------------------------------------

/**
 * Deterministic student id used across apply calls so the backend joins the
 * same documents the verify stage uploaded (LiveVerificationProfileStore keys
 * off this id: `_verified_{university_id}_{student_id}`).
 * Matches lib/verify.buildStudentId.
 */
export function buildApplyStudentId(fullName: string | null | undefined): string {
  const base = (fullName || "student")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `LIVE-${base || "student"}`;
}

/**
 * Build the apply request body. `university` here is the RESOLVED apply-module
 * university (its `id` in the shared verify/apply catalogue, e.g. UNIV_US_NSU)
 * — resolved by name-match from the result card, exactly as VerifyFlow does.
 */
export function buildApplyBody(
  fullName: string | null | undefined,
  applyUniversityId: string,
  program?: string
): { student_id: string; university_id: string; program?: string } {
  return {
    student_id: buildApplyStudentId(fullName),
    university_id: applyUniversityId,
    program: program || undefined,
  };
}

/** Resolve a result-card University to the apply/verify catalogue id by name
 * match, falling back to a "generic-<key>" id — the same rule VerifyFlow uses,
 * so Apply and Verify agree on identity for the same selection. */
export function resolveApplyUniversityId(
  university: University | null,
  catalogue: { id: string; name: string }[]
): string | null {
  if (!university) return null;
  const match = catalogue.find(
    (v) => v.name.toLowerCase() === university.name.toLowerCase()
  );
  return (match ?? { id: `generic-${university.key}` }).id;
}

// ---------------------------------------------------------------------------
// HTTP calls
// ---------------------------------------------------------------------------

export async function applyHealth(): Promise<{ status: string }> {
  return applyRequest<{ status: string }>("/health");
}

export async function checkApplyReadiness(
  studentId: string,
  universityId: string,
  program?: string
): Promise<ApplyReadiness> {
  const qs = program ? `?program=${encodeURIComponent(program)}` : "";
  return applyRequest<ApplyReadiness>(
    `/readiness/${encodeURIComponent(studentId)}/${encodeURIComponent(universityId)}${qs}`
  );
}

/** Start the automation. `202` means accepted; the orchestrator runs in a
 * background task — poll getApplyApplication to follow its live state. */
export async function startApply(body: {
  student_id: string;
  university_id: string;
  program?: string;
}): Promise<ApplyStartedResponse> {
  return applyRequest<ApplyStartedResponse>("/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getApplyApplication(applicationId: string): Promise<ApplyApplication> {
  return applyRequest<ApplyApplication>(`/applications/${encodeURIComponent(applicationId)}`);
}

/** Resume a paused automation with the student's answer / confirmation. */
export async function resumeApply(
  applicationId: string,
  action: ApplyStudentAction
): Promise<ApplyResumeResponse> {
  return applyRequest<ApplyResumeResponse>(
    `/applications/${encodeURIComponent(applicationId)}/resume`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    }
  );
}

export async function getApplyAudit(applicationId: string): Promise<ApplyAuditEntry[]> {
  return applyRequest<ApplyAuditEntry[]>(`/applications/${encodeURIComponent(applicationId)}/audit`);
}

export async function listApplyInbox(studentId: string): Promise<ApplyInboxItem[]> {
  return applyRequest<ApplyInboxItem[]>(`/inbox/${encodeURIComponent(studentId)}`);
}
