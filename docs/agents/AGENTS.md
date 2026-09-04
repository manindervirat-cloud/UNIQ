# UniQ — Agent Index

UniQ exposes every long-lived capability as an **agent**: a named, versioned,
replaceable unit that conforms to the `BaseAgent` contract in
`src/backend/agents/base.py`. Four agents ship with the platform today.
This document names each one, points at every file involved, and explains
how to swap one out without touching the rest of the system.

> **Why "agents" and not "AI agents"?**
> The word *agent* here means *replaceable capability unit*, not necessarily
> LLM-driven. The University agent is deterministic; SOP and Document
> Verification are LLM-assisted; Apply automation is rule-based. The contract
> is the same for all of them so any of them can be replaced with a remote
> microservice, a different model provider, or a test double without editing
> call sites.

---

## The four agents

| # | Agent | What it does | Wrapper | Real logic lives in | HTTP surface |
|---|---|---|---|---|---|
| 1 | **University** | Eligibility-first ranking, recommendation, reranking, comparison, roadmap | `src/backend/agents/university_agent.py` | `src/backend/core/` (models, database) + `src/backend/services/university_service.py` | `/api/*` (host's own routes) |
| 2 | **SOP** | Statement-of-Purpose generation + revision | `src/backend/agents/sop_agent.py` + `src/backend/agents/_sop_adapters.py` | `src/backend/modules/sop/` (entire package) | `/api/v1/sop/*` (mounted router) |
| 3 | **Document Verification** | 5-step pipeline (tamper, QR, OCR, LLM cross-check, national registry) | `src/backend/agents/verify_agent.py` | `src/backend/modules/verify/` (entire package) | `/api/v1/verify/*` (mounted router) |
| 4 | **Application Automation** | Apply orchestrator, readiness gate, pause/resume, audit, inbox, task tracking | `src/backend/agents/apply_agent.py` | `src/backend/modules/apply/` (entire package) | `/api/v1/apply/*` (mounted router) |

The four wrappers are **thin adapters**: each is one file that translates
`AgentRequest` envelopes into calls on the underlying capability. The actual
business logic lives in the package listed under "Real logic lives in" —
that's the file tree you replace, not the wrapper.

---

## Where the wrappers live

```
src/backend/agents/
├── __init__.py              # Public surface: BaseAgent, AgentRequest/Response, AgentStatus, AgentRegistry
├── base.py                  # The contract every agent implements
├── registry.py              # Process-wide singleton: register / replace / dispatch / health
├── _sop_adapters.py         # SOP-specific dict-shape converters (kept private — only sop_agent.py imports it)
├── university_agent.py      # Agent 1
├── sop_agent.py             # Agent 2
├── verify_agent.py          # Agent 3
└── apply_agent.py           # Agent 4
```

The `agents/` folder is intentionally flat — each wrapper is one file, so
opening one folder already shows you everything. Splitting wrappers into
`Agent_1/` … `Agent_4/` sub-folders would scatter them without adding clarity.

---

## The contract every agent fulfils

Defined in `src/backend/agents/base.py`:

- `name` — stable, unique identifier (`"university"`, `"sop"`, `"verify"`, `"apply"`).
- `version` — semver-ish implementation version.
- `description` — one-line summary used in `/api/health` diagnostics.
- `supported_actions` — set of action strings (`"university.search"`, `"sop.generate"`, …).
- `execute(request: AgentRequest) -> AgentResponse` — the single entry point. Must **not raise** for application errors; return `AgentResponse(success=False, error="...")` instead.
- `health_check() -> bool` — non-throwing liveness probe (≤ a couple of ms).

The process-wide registry (`src/backend/agents/registry.py`) routes an
`AgentRequest` to the first agent whose `supported_actions` contains the
action. Lookups are by name *or* by action; registration order sets precedence.

---

## Replacing an agent

To swap any agent — e.g. point `sop` at a remote microservice, or replace
`apply` automation with a different engine — you only edit the wrapper and
(optionally) the underlying module. **You do not touch call sites.**

### Recipe — replacing an LLM-backed agent (sop or verify)

1. **Implement the new capability** in a self-contained package under
   `src/backend/modules/<name>/` (mirroring the existing `sop/`, `verify/`,
   `apply/` layouts: `api/`, `domain/` or `pipeline/`, `config/`, plus
   whatever sub-packages you need).
2. **Mount it** in `src/backend/api/routes.py`:
   ```python
   from ..modules.<name>.api.routers.<name> import router as <name>_router
   app.include_router(<name>_router, prefix="/api/v1/<name>")
   ```
3. **Rewrite the wrapper** at `src/backend/agents/<name>_agent.py` to call
   your new module instead of the old one. Keep the same `name`, `version`,
   `description`, and `supported_actions` so the registry contract is unchanged.
4. **Optional**: delete the old module under `src/backend/modules/`. Nothing
   else imports it directly — call sites go through the wrapper.

### Recipe — replacing the deterministic University agent

The University agent is different: it has no embedded sub-package, because
its logic is the host's own `src/backend/core/` and `src/backend/services/`.
To swap it:

1. Implement the new service module under any location (e.g.
   `src/backend/services/university_service_v2.py`).
2. Rewrite `src/backend/agents/university_agent.py` to call the new service.
   Keep the same `supported_actions` list.
3. Optionally delete `src/backend/core/models.py`, `core/database.py`,
   `services/university_service.py`, and the `/api/*` handlers in
   `src/backend/api/routes.py` once nothing else references them.

### Recipe — replacing the host-side dispatch layer

The registry is a singleton accessed via `get_registry()`. To point the
entire platform at a remote agent gateway, replace the dispatch layer
(`src/backend/agents/registry.py`'s `dispatch` method) with an HTTP client —
the wrapper classes don't need to change.

---

## What's protected vs. replaceable

| Surface | Replaceable? | Why |
|---|---|---|
| `src/backend/agents/base.py` (contract) | **No** — the platform imports `BaseAgent` everywhere | Changing it requires updating every wrapper |
| `src/backend/agents/registry.py` (lookup) | Yes — but keep `get_registry()`'s signature | The dispatch semantics are referenced by callers |
| `<name>_agent.py` (wrapper) | **Yes** | This is the swap point |
| `src/backend/modules/<name>/` (logic) | **Yes** | This is what the wrapper delegates to |
| `src/backend/api/routes.py` (mount) | Yes — but keep the prefixes stable | Frontend proxies depend on the path |

---

## Health & status snapshot

Every agent implements `health_check()`. The registry exposes
`status_all()` and `health_check_all()` for batch diagnostics; surface them
through `/api/health` (already wired in `src/backend/api/routes.py`).

For per-agent status, the wrappers expose `BaseAgent.status() ->
AgentStatus`, which bundles identity + supported actions + health into one
dataclass suitable for JSON.

