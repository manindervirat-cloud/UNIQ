import type {
  Meta,
  Roadmap,
  RerankEntry,
  SearchResponse,
  StudentPayload,
  UniversityDetail,
  ValidationResponse,
} from "@/types/api";
import type {
  SopCompletenessReport,
  SopFieldDefinition,
  SopFollowUpRequest,
  SopFollowUpResponse,
  SopGenerateRequest,
  SopGenerateResponse,
  SopHealthResponse,
  SopInterviewPlan,
  SopInterviewStartRequest,
  SopRequirementsRequest,
  SopReviseRequest,
} from "@/types/sop";
import type {
  VerifyApplicationOption,
  VerifyHealthResponse,
  VerifyReport,
  VerifyUniversity,
} from "@/types/verify";

/**
 * Typed API client. All calls go through Next.js rewrites (/api/* →
 * FastAPI), so there is a single origin in the browser.
 *
 * The SOP methods hit /api/v1/sop/* on the same origin; the Next.js rewrite
 * forwards them to the FastAPI app where the embedded SOP router is mounted.
 * No second service, no CORS, no separate auth.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

/**
 * Extracts a student-safe message from an error response. The raw body may
 * contain stack traces, validation dumps or internal details — only a clean
 * `detail`/`message` string is ever surfaced; anything else becomes a generic
 * friendly line. Technical context belongs in server logs, not the UI.
 */
async function safeErrorMessage(res: Response): Promise<string> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body — fall through to generic message */
  }
  if (body && typeof body === "object") {
    const d = (body as Record<string, unknown>).detail ?? (body as Record<string, unknown>).message;
    if (typeof d === "string" && d.length > 0 && d.length < 300) return d;
  }
  return `Something went wrong (${res.status}). Please try again.`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(res.status, await safeErrorMessage(res));
  }
  return (await res.json()) as T;
}

export const api = {
  meta: () => request<Meta>("/api/meta"),
  validate: (payload: Partial<StudentPayload>) =>
    request<ValidationResponse>("/api/validate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  search: (payload: StudentPayload) =>
    request<SearchResponse>("/api/search", { method: "POST", body: JSON.stringify(payload) }),
  university: (key: string, payload: StudentPayload) =>
    request<UniversityDetail>(`/api/university/${encodeURIComponent(key)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  roadmap: (key: string, payload: StudentPayload) =>
    request<Roadmap>(`/api/university/${encodeURIComponent(key)}/roadmap`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  rerank: (payload: StudentPayload & { rankedKeys: string[] }) =>
    request<{ entries: RerankEntry[] }>("/api/rerank", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  compare: (payload: StudentPayload & { keys: string[] }) =>
    request<{ results: SearchResponse["ranked"] }>("/api/compare", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ── SOP module (embedded at /api/v1/sop on the same FastAPI app) ──────────
  // These reuse the existing /api proxy and request() helper. Bodies use the
  // snake_case shapes from src/types/sop.ts, which the backend accepts.
  sopHealth: () => request<SopHealthResponse>("/api/v1/sop/health"),
  sopFields: () => request<SopFieldDefinition[]>("/api/v1/sop/fields"),
  sopRequirements: (payload: SopRequirementsRequest) =>
    request<SopCompletenessReport>("/api/v1/sop/requirements", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  // Adaptive interview: value-ranked question plan + per-answer follow-up.
  sopInterviewStart: (payload: SopInterviewStartRequest) =>
    request<SopInterviewPlan>("/api/v1/sop/interview/start", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  sopInterviewFollowup: (payload: SopFollowUpRequest) =>
    request<SopFollowUpResponse>("/api/v1/sop/interview/followup", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  sopGenerate: (payload: SopGenerateRequest) =>
    request<SopGenerateResponse>("/api/v1/sop/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  sopRevise: (payload: SopReviseRequest) =>
    request<SopGenerateResponse>("/api/v1/sop/revise", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ── Document Verification module (embedded at /api/v1/verify) ─────────────
  // Same-origin via the /api proxy like every other call. /verify is multipart
  // (files + form fields), so it uses its own helper that does NOT set the JSON
  // Content-Type header — the browser sets the multipart boundary itself.
  verifyHealth: () => request<VerifyHealthResponse>("/api/v1/verify/health"),
  verifyUniversities: () => request<VerifyUniversity[]>("/api/v1/verify/universities"),
  verifyApplications: () =>
    request<VerifyApplicationOption[]>("/api/v1/verify/applications"),
  verifyRun: (form: FormData) => postForm<VerifyReport>("/api/v1/verify/verify", form),
};

/**
 * Multipart POST helper for the document-upload endpoint. Unlike request(), it
 * sends a FormData body and lets the browser set the Content-Type (with the
 * multipart boundary) — setting application/json here would corrupt the upload.
 */
async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, { method: "POST", body: form });
  if (!res.ok) {
    throw new ApiError(res.status, await safeErrorMessage(res));
  }
  return (await res.json()) as T;
}
