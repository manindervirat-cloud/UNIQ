# Documentation

Documentation index for the Study Abroad AI Platform. For setup and how to run
the app, start with the [root README](../README.md).

## Reference

| Document | Contents |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design: the three backend layers, the eligibility-first pipeline, and the 8-pillar ranking model. |
| [API.md](API.md) | HTTP reference for all 8 endpoints under `/api`, with request and response shapes. |
| [agents/AGENTS.md](agents/AGENTS.md) | Index of the four built-in agents (University, SOP, Verify, Apply) — wrappers, logic, and the recipe for replacing any of them. |

## Guides

| Document | Contents |
| --- | --- |
| [guides/QUICK_START.md](guides/QUICK_START.md) | Fast onboarding summary for new developers. |

## Reports

`reports/` holds point-in-time engineering records. They document decisions and
migrations as they happened and are **not** kept up to date — treat them as a
historical archive, not as current reference. When a report disagrees with
`ARCHITECTURE.md` or the root `README.md`, the latter two are correct.

| Report | Records |
| --- | --- |
| [reports/EXECUTIVE_SUMMARY.md](reports/EXECUTIVE_SUMMARY.md) | High-level summary of the backend migration to `src/backend/`. |
| [reports/FINAL_REORGANIZATION_REPORT.md](reports/FINAL_REORGANIZATION_REPORT.md) | Detailed file-by-file migration record. |
| [reports/FINAL_VERIFICATION_SUMMARY.md](reports/FINAL_VERIFICATION_SUMMARY.md) | Verification results for that migration. |
| [reports/NEW_STRUCTURE_DESIGN.md](reports/NEW_STRUCTURE_DESIGN.md) | Target-structure design that guided the migration. |
| [reports/REORGANIZATION_REPORT.md](reports/REORGANIZATION_REPORT.md) | Earlier reorganization pass, superseded by the final report. |
| [reports/MANUAL_STEPS_REQUIRED.md](reports/MANUAL_STEPS_REQUIRED.md) | Manual-operations checklist from the migration (all items complete). |
| [reports/VERIFY_INTEGRATION.md](reports/VERIFY_INTEGRATION.md) | Engineering record for the Document Verification module integration. |

## Where code lives

```
src/backend/          Python backend
  api/                HTTP routes + middleware (FastAPI)
  services/           JSON adapters between HTTP and the domain
  core/               domain models + university dataset (framework-free)
  config/             environment-backed settings
  modules/            embedded capability packages
    sop/              SOP generation module
    verify/           Document Verification module
    apply/            Application Automation module
  agents/             thin BaseAgent wrappers + registry (see src/backend/agents/README.md)
  main.py             ASGI entry point — uvicorn src.backend.main:app

frontend/src/         Next.js 14 App Router (TypeScript)
  app/                routes: / · /results · /university/[key] · /compare
  components/         UI primitives, result cards, roadmap, media hub
  hooks/              useProfile — localStorage persistence
  lib/                typed API client + helpers
  types/              API types mirroring backend serialization

tests/backend/        pytest suite
scripts/              Windows launchers
```
