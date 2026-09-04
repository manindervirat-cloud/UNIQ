# Document Verification Integration — Complete

The Document Verification Agent is now fully integrated as a native embedded module following the exact same pattern as the SOP module. The student journey is seamless: **University Agent → SOP Agent → Document Verification** — three continuous stages of one application.

---

## What Was Built

### Backend (Embedded Module Pattern)

**Location:** `src/backend/modules/verify/`

The verification pipeline was vendored from the standalone `admission-verifier` app and refactored as a pluggable module mounted at `/api/v1/verify/*`. Only the verification logic was ported — the original standalone frontend was intentionally discarded.

**Key files:**
- `api/routers/verify.py` — APIRouter with 4 endpoints (health, universities, applications, verify)
- `pipeline/` — 5-step verification pipeline (tamper_check, qr_check, ocr_extract, llm_crosscheck, national_registry, orchestrator)
- `config/env.py` — repo-root `.env` loader (ported from SOP fix, ensures `ANTHROPIC_API_KEY` is actually loaded)
- `config/settings.py` — pydantic-settings with `ai_enabled` flag
- `api/errors.py` — VerifyError + structured handler (registered on the host app alongside SOPError)
- `mock_data/` — universities.json, document_types.json, national_registries.json, applications_db.json

**Mounted in `routes.py`:**
```python
from ..modules.verify.api.errors import VerifyError, handle_verify_error
from ..modules.verify.api.routers.verify import router as verify_router

app.include_router(verify_router, prefix="/api/v1/verify")
app.add_exception_handler(VerifyError, handle_verify_error)
```

**Critical fixes applied:**
1. **Lazy imports** — `cv2`, `numpy`, `pytesseract`, `PIL`, `rapidfuzz` moved inside functions so `/health`, `/universities`, `/applications` work with zero heavy deps installed. Verified: 0 top-level optional-dep imports across all pipeline files.
2. **Env loader** — `config/env.py` loads the repo-root `.env` CWD-independently (same bug that left SOP permanently in template mode). `ANTHROPIC_API_KEY` now engages the LLM cross-check when configured.
3. **Live profile injection** — `POST /verify` accepts an optional `applicant_record` JSON form field. When the host platform passes it, the cross-check compares documents against the LIVE student profile (name, grades, scores, course) — the student is never re-asked. When omitted, it falls back to the bundled demo record, preserving standalone behaviour.

**15 Python files, all compile clean, zero syntax errors.**

---

### Frontend (Native UI Extension)

**New files:**
- `types/verify.ts` — wire types mirroring the backend exactly (VerifyHealthResponse, VerifyUniversity, VerifyReport, etc.)
- `lib/verify.ts` — `buildApplicantRecord()` + `buildStudentId()` — map the StudentPayload + University into the `applicant_record` the backend cross-checks against. This is where "never re-ask the student" lives.
- `components/verify/VerifyFlow.tsx` — the full-viewport portal overlay matching SopFlow's design system exactly (panel, well, Button, Field, AnalysisCard, InsightPanel, Callout, DangerAlert, motion presets).

**Modified files:**
- `lib/api.ts` — added 4 verify methods (verifyHealth, verifyUniversities, verifyApplications, verifyRun). The `/verify` endpoint is multipart, so a `postForm()` helper was added that skips the `Content-Type: application/json` header.
- `components/sop/SopFlow.tsx` — added optional `onContinueApplication` prop + VerifyFlow mount. When the prop is provided, a "Continue application" button appears in the SOP result view as the primary next-step action.
- `components/results/ResultCard.tsx` — wired the handoff: passes `onContinueApplication={() => { setSopOpen(false); setVerifyOpen(true); }}` to SopFlow, so clicking the button closes the SOP overlay and opens VerifyFlow with the same university + profile.

**TypeScript compiles clean (0 errors).**

---

## Student Journey (Continuous Flow)

1. **University Agent** — student enters profile, searches, picks a university.
2. **Generate SOP** (from result card) — overlay opens, collects narrative answers, drafts SOP.
3. **Continue application** (from SOP result) — closes SOP overlay, opens VerifyFlow overlay with the same university pre-selected.
4. **VerifyFlow** — one-time name confirm, document checklist (dynamically loaded per university), multipart upload, 5-step pipeline runs, readiness report shows per-document status + overall application verdict.

**No route changes. No redirects. No separate app. No iframe. No second service.** The student never feels they left the platform — it reads as one unified AI application.

---

## Data Flow (Never Re-Ask the Student)

The University Agent profile already holds:
- Academic record (grading system, GPA/percentage, backlogs)
- English proficiency (IELTS/TOEFL/etc + score)
- Standardized tests (SAT/GRE/GMAT + scores)
- Target course + degree level
- Selected university

**`buildApplicantRecord()` maps this into the shape the backend's application-form cross-check expects:**
- `name` (one-time confirm in VerifyFlow, persisted to localStorage)
- `gpa` / `percentage` (derived from gradingValue + gradingSystem)
- `test_type` + `score` (first non-zero English test)
- `test_scores` (comma-list of aptitude tests)
- `course_applied` (university.courseName or profile.targetCourse)
- `school_name` (university.name)
- `graduation_year` (extracted from intakeSession like "Fall 2026")
- `backlogs`

**Handed to the backend as a JSON form field alongside the uploaded files.** The orchestrator injects it into every document's cross-check step, so each uploaded passport/marksheet/transcript is compared against the student's OWN details — the exact behaviour the original standalone app had, now fed with live data instead of a static demo record.

---

## Architecture Compliance

✓ **No second FastAPI app** — the verify module exposes only an APIRouter, mounted on the existing host app.  
✓ **No second service / no second port** — same `/api` proxy, same origin, no CORS middleware in the module.  
✓ **No standalone frontend** — the original `admission-verifier/frontend/` was intentionally not vendored. Only the verification logic crossed over.  
✓ **Lazy imports** — 0 top-level `cv2`/`numpy`/`pytesseract`/`PIL`/`rapidfuzz` imports (per `modules/__init__.py` contract). Verified by grep audit.  
✓ **Env loader** — repo-root `.env` loaded CWD-independently (fixes the SOP "stuck in template" root cause, applied here from day one).  
✓ **Same design system** — VerifyFlow reuses Button, Field, AnalysisCard, InsightPanel, Callout, DangerAlert, motion presets, portal pattern, body scroll lock, escape-to-close — identical to SopFlow.  
✓ **Structured errors** — VerifyError handler registered on the host app alongside SOPError; both are more specific than the global catch-all, so they intercept only their own exceptions and leave the rest untouched.  
✓ **Profile builders** — `buildApplicantRecord()` follows the same pattern as `buildSopAnswers()`: only populate what the profile actually knows, never invent.  
✓ **Pluggable** — future modules (LOR, Visa, Scholarship, Interview Prep, Resume) follow this exact pattern: vendor at `modules/<name>/`, expose an APIRouter, lazy-import heavy deps, mount in `routes.py`, add frontend types/client/builder/overlay.

---

## What to Test (User-Side, Can't Run in Sandbox)

1. **Backend dependencies** — the verify pipeline needs these system tools + Python wrappers:
   - Tesseract OCR (system): `brew install tesseract` / Windows installer
   - Poppler (system, for PDF rasterization): `brew install poppler` / Windows build
   - Python: `pip install pytesseract opencv-python-headless pdf2image pypdf pillow rapidfuzz anthropic requests python-multipart --break-system-packages`
   
   The pipeline degrades gracefully when deps are missing (OCR/QR steps report "unavailable" as flags instead of crashing), but a real verification needs them.

2. **AI cross-check** — add `ANTHROPIC_API_KEY=sk-ant-...` to the repo-root `.env` so the application-form cross-check uses Claude instead of the fuzzy fallback. Without the key it still works (rapidfuzz scoring), just less accurate on messy OCR / name variants.

3. **Full journey test:**
   - Restart backend: `scripts\start-backend.bat` (NO `--reload` — Dropbox sync triggers false restarts)
   - `npm run build` in `frontend/` (production mode), then `npm start`
   - Search for a university, click "Generate SOP", complete the interview, generate draft
   - Click "Continue application" (primary button in the SOP result)
   - VerifyFlow opens with the same university pre-selected
   - Confirm name (one-time, persists to localStorage)
   - Attach documents (the checklist is dynamic per university — Indian unis want marksheets/ID, US/UK unis want transcripts/passport/English cert)
   - Click "Run verification"
   - Pipeline runs (5-10 seconds per document depending on OCR/LLM), report shows per-document status + overall verdict

4. **Profile reuse check** — upload a marksheet: the cross-check should compare its OCR text against the `percentage`/`board`/`name` derived from the StudentPayload. Upload a passport: should check `name`/`nationality`. Upload an English cert: should check `test_type`/`score` from `profile.englishTests`. If it flags a mismatch, the "What to fix" panel surfaces it as a student-facing alert.

5. **Missing documents** — omit one required document → overall verdict = "INCOMPLETE", missing list shown, student can re-run after attaching it.

---

## Files Changed

**Backend (18 files):**
- `src/backend/api/routes.py` — mounted verify_router + registered VerifyError handler
- `src/backend/modules/verify/` — 15 new Python files (router, pipeline, config, errors, __init__ stubs)

**Frontend (7 files):**
- `frontend/src/types/verify.ts` — new
- `frontend/src/lib/verify.ts` — new
- `frontend/src/lib/api.ts` — added 4 verify methods + postForm helper
- `frontend/src/components/verify/VerifyFlow.tsx` — new (646 lines)
- `frontend/src/components/sop/SopFlow.tsx` — added onContinueApplication prop + VerifyFlow mount
- `frontend/src/components/results/ResultCard.tsx` — wired handoff callback + VerifyFlow mount

**All compile clean. Zero TypeScript errors. Zero Python syntax errors.**

---

## What's Next (Future Modules)

This integration establishes the repeatable pattern:

1. Vendor logic at `src/backend/modules/<module>/` (no standalone frontend)
2. Expose APIRouter, lazy-import heavy deps, mount in `routes.py` with `prefix="/api/v1/<module>"`
3. Add frontend `types/<module>.ts`, `lib/<module>.ts` (builders), API client methods
4. Build `<Module>Flow.tsx` overlay reusing the design system
5. Wire handoff from the prior stage (e.g. VerifyFlow's "Submit application" → LOR request overlay)

Each stage closes and the next opens — same motion, same portal pattern, same continuous journey. The platform scales horizontally without rewriting.
