# New Repository Structure Design

## Production-Ready Folder Structure (Implemented)

```
study-abroad-ai/
├── docs/                           # Documentation
│   ├── README.md                   # Main project documentation ✅
│   ├── ARCHITECTURE.md             # System architecture ✅
│   ├── API.md                      # API documentation ✅
│   ├── DEPLOYMENT.md               # Deployment guide (to be created)
│   └── DEVELOPMENT.md              # Developer setup guide (to be created)
│
├── src/                            # Backend source code
│   ├── backend/                    # Python FastAPI backend
│   │   ├── api/                    # API layer
│   │   │   ├── __init__.py
│   │   │   ├── routes.py          # API endpoints (from main.py) ✅
│   │   │   └── middleware.py      # CORS, error handling ✅
│   │   │
│   │   ├── core/                   # Core business logic
│   │   │   ├── __init__.py
│   │   │   ├── models.py          # Domain models (from shared/models.py) ✅
│   │   │   └── database.py        # University data (from shared/university_database.py) ✅
│   │   │
│   │   ├── services/               # Application services
│   │   │   ├── __init__.py
│   │   │   └── university_service.py  # Service layer (from backend/services.py) ✅
│   │   │
│   │   ├── config/                 # Configuration
│   │   │   ├── __init__.py
│   │   │   └── settings.py        # Environment config ✅
│   │   │
│   │   ├── __init__.py
│   │   └── main.py                 # Application entry point ✅
│   │
│   └── __init__.py                 # Package marker for src.backend resolution ✅
│
├── frontend/                       # Next.js frontend (at repository root) ✅
│   ├── src/                        # TypeScript source
│   │   ├── app/                    # Next.js App Router pages
│   │   ├── components/             # React components
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── lib/                    # Utilities & API client
│   │   ├── types/                  # TypeScript types
│   │   └── styles/                 # Global styles
│   │
│   ├── public/                     # Static assets
│   ├── .env.example                # Frontend environment template ✅
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs             # Updated to use documented env vars ✅
│   └── tailwind.config.js
│
├── scripts/                        # Utility scripts
│   ├── start-dev.bat              # Unified development startup (Windows) ✅
│   ├── start-backend.bat          # Backend server starter (Windows) ✅
│   ├── start-frontend.bat         # Frontend server starter (Windows) ✅
│   ├── setup.bat                  # Initial setup (Windows) (to be created)
│   ├── setup.sh                   # Initial setup (Unix) (to be created)
│   └── start-dev.sh               # Development startup (Unix) (to be created)
│
├── tests/                          # Test suite (to be created)
│   ├── backend/                    # Backend tests
│   │   ├── test_api.py
│   │   ├── test_models.py
│   │   └── test_services.py
│   │
│   └── frontend/                   # Frontend tests
│       └── (test files)
│
├── .github/                        # GitHub configuration (to be created)
│   └── workflows/                  # CI/CD pipelines
│       └── ci.yml
│
├── .vscode/                        # VS Code settings (optional)
│   ├── settings.json
│   └── launch.json
│
├── START_HERE.bat                  # One-click Windows setup & launch ✅
├── .env.example                    # Root environment template ✅
├── .gitignore                      # Git ignore rules ✅
├── .dockerignore                   # Docker ignore rules (to be created)
├── Dockerfile                      # Docker container definition (to be created)
├── docker-compose.yml              # Multi-container orchestration (to be created)
├── requirements.txt                # Python dependencies ✅
├── requirements-dev.txt            # Development dependencies ✅
├── pyproject.toml                  # Python project metadata (to be created)
├── README.md                       # Quick start guide ✅
├── QUICK_START.md                  # Fast onboarding summary ✅
└── LICENSE                         # License file (to be created)
```

## Key Design Principles

### 1. Clear Separation of Concerns
- `src/backend/` - All Python backend code
- `frontend/` - All TypeScript frontend code (at repository root)
- `docs/` - All documentation
- `scripts/` - All utility scripts
- `tests/` - All test code

### 2. Standard Python Package Structure
- Backend follows standard Python package layout
- Clear module hierarchy: api → services → core
- Proper `__init__.py` files for clean imports, including `src/__init__.py` for Uvicorn

### 3. Production-Ready Features
- Environment configuration at root and per-service
- Docker support planned for containerization
- CI/CD workflow templates planned
- Comprehensive documentation structure
- Testing infrastructure planned

### 4. Developer Experience
- Easy setup scripts for Windows (Unix versions planned)
- Clear environment variable management
- IDE configuration can be added
- Consistent naming conventions

## Migration Map (Completed)

### Files Moved

**Backend:**
- `backend/main.py` → `src/backend/api/routes.py` + `src/backend/main.py` ✅
- `backend/services.py` → `src/backend/services/university_service.py` ✅
- `shared/models.py` → `src/backend/core/models.py` ✅
- `shared/university_database.py` → `src/backend/core/database.py` ✅

**Frontend:**
- `frontend/` → `frontend/` (kept at repository root) ✅

**Scripts:**
- `START_HERE.bat` → kept and updated with correct paths ✅
- `scripts/start-backend.bat` → updated to use `src.backend.main:app` ✅
- `scripts/start-frontend.bat` → kept (points to `frontend/`) ✅
- `scripts/start.bat` → replaced by `scripts/start-dev.bat` ✅

**Documentation:**
- `README.md` → updated ✅
- Created `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/API.md` ✅
- Created `QUICK_START.md` ✅

**Configuration:**
- `.env.example` → kept at root and updated ✅
- `frontend/.env.example` → updated ✅
- `.gitignore` → kept at root and updated ✅

### Files Deleted (Completed)

**Legacy Web Framework:**
- `legacy/` (entire folder) ✅

**Redundant:**
- `shared/` (migrated to `src/backend/core/`) ✅
- `backend/` (migrated to `src/backend/`) ✅
- `scripts/start.bat` (replaced by `scripts/start-dev.bat`) ✅
- `legacy-removal-helper.bat` (legacy no longer exists) ✅

### Files to Create (Optional Future Work)

**Core:**
- `pyproject.toml` - Python project metadata
- `Dockerfile` - Container definition
- `docker-compose.yml` - Multi-service orchestration

**Documentation:**
- `docs/DEPLOYMENT.md` - Deployment guide
- `docs/DEVELOPMENT.md` - Developer guide

**Backend:**
- Already complete; no additional core files needed

**Scripts:**
- `scripts/setup.bat` - Initial setup (Windows)
- `scripts/setup.sh` - Initial setup (Unix)
- `scripts/start-dev.sh` - Development startup (Unix)

**Testing:**
- `tests/backend/test_api.py`
- `tests/backend/test_models.py`
- `tests/backend/test_services.py`

**CI/CD:**
- `.github/workflows/ci.yml`

## Benefits of New Structure

1. **Scalability** - Easy to add new modules, services, or features
2. **Maintainability** - Clear boundaries between components
3. **Professionalism** - Follows industry best practices
4. **Onboarding** - New developers can navigate easily
5. **Testing** - Clear test organization
6. **Deployment** - Docker support, CI/CD ready
7. **Documentation** - Comprehensive docs structure
8. **Cross-platform** - Windows scripts complete; Unix scripts planned

## Important Notes

- The frontend was intentionally kept at the repository root rather than under `src/frontend/` because the attempted directory move failed on the large `node_modules` directory, and root-level frontend is a production-valid layout.
- `src/__init__.py` was added to make `src.backend.main:app` resolvable by Uvicorn.
- Blank-screen fixes were applied in `frontend/next.config.mjs` (rewrite config) and `frontend/src/components/profile/ProfileWizard.tsx` (error/slow-loading UI).
- All legacy web framework code, dependencies, and references have been removed.
