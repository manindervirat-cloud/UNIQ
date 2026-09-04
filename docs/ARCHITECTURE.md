# System Architecture

## Overview

The Study Abroad AI Platform follows a modern 3-tier architecture with clear separation of concerns:

1. **Presentation Layer** - Next.js frontend (React + TypeScript)
2. **Application Layer** - FastAPI backend (Python)
3. **Domain Layer** - Pure business logic (framework-agnostic)

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser                              │
│                    (Next.js Frontend)                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Profile    │  │   Results    │  │  University  │     │
│  │    Page      │  │    Page      │  │   Detail     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                  │                  │             │
│         └──────────────────┴──────────────────┘             │
│                            │                                 │
│                  ┌─────────▼──────────┐                     │
│                  │   API Client       │                     │
│                  │  (React Query)     │                     │
│                  └─────────┬──────────┘                     │
└──────────────────────────┬─┴───────────────────────────────┘
                            │ HTTP/JSON
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    FastAPI Backend                           │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 API Layer (routes.py)                 │  │
│  │  GET  /api/health                                     │  │
│  │  GET  /api/meta                                       │  │
│  │  POST /api/validate                                   │  │
│  │  POST /api/search                                     │  │
│  │  POST /api/university/{key}                           │  │
│  │  POST /api/university/{key}/roadmap                   │  │
│  │  POST /api/rerank                                     │  │
│  │  POST /api/compare                                    │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │         Service Layer (university_service.py)        │  │
│  │  • JSON serialization                                │  │
│  │  • Request/Response mapping                          │  │
│  │  • Orchestration                                     │  │
│  └────────────────────┬─────────────────────────────────┘  │
│                       │                                      │
│  ┌────────────────────▼─────────────────────────────────┐  │
│  │           Domain Layer (core/)                       │  │
│  │                                                       │  │
│  │  models.py:                                          │  │
│  │    • StudentProfile                                  │  │
│  │    • UniversityProfile                               │  │
│  │    • 8-Pillar Ranking Engine                         │  │
│  │    • Eligibility Checks                              │  │
│  │    • Budget/Grading Parsers                          │  │
│  │                                                       │  │
│  │  database.py:                                        │  │
│  │    • 237 Universities                                │  │
│  │    • Country Metadata                                │  │
│  │    • Course Catalog                                  │  │
│  │    • City Intelligence                               │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### 1. Frontend (Presentation Layer)

**Location:** `frontend/`

**Responsibilities:**
- User interface rendering
- Form validation and state management
- API communication
- Client-side routing
- Responsive design

**Key Technologies:**
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Query** - Server state caching
- **React Hook Form + Zod** - Form handling

**Structure:**
```
frontend/
├── app/              # Next.js pages (App Router)
│   ├── page.tsx      # Home/Profile page
│   ├── results/      # Search results
│   ├── university/   # University detail
│   └── compare/      # Comparison page
├── components/       # Reusable UI components
├── hooks/            # Custom React hooks (useProfile, etc.)
├── lib/              # Utilities & API client
└── types/            # TypeScript type definitions
```

### 2. Backend API Layer

**Location:** `src/backend/api/`

**Responsibilities:**
- HTTP endpoint routing
- Request validation
- CORS configuration
- Error handling
- Response serialization

**Key Files:**
- `routes.py` - All HTTP endpoints
- `middleware.py` - CORS, error handling

**Design Pattern:** Thin controller - delegates to service layer

### 3. Service Layer

**Location:** `src/backend/services/`

**Responsibilities:**
- Orchestration of domain logic
- JSON serialization of domain objects
- Request/response mapping
- No business logic (pure orchestration)

**Key Principle:** Service layer is a translation layer between HTTP and domain

### 4. Domain Layer (Core)

**Location:** `src/backend/core/`

**Responsibilities:**
- Pure business logic
- Data models and validation
- Ranking algorithms
- Eligibility calculations
- Budget/grading normalization

**Key Files:**
- `models.py` - All business logic (2087 lines)
- `database.py` - University data (855 lines)

**Key Principle:** Framework-agnostic - could be used by any interface

## Data Flow

### Search Request Flow

```
1. User fills profile form in frontend
   └─> React Hook Form validation

2. Frontend submits to /api/search
   └─> POST request with JSON payload

3. API layer receives request
   └─> routes.py validates with Pydantic

4. Service layer processes
   └─> university_service.search()
   └─> Converts JSON → StudentProfile

5. Domain layer executes
   └─> models.py
   └─> Eligibility filtering
   └─> 8-pillar scoring
   └─> Ranking and sorting

6. Service layer serializes
   └─> UniversityProfile → JSON dict
   └─> Adds metadata

7. API layer returns response
   └─> FastAPI auto-serializes to JSON

8. Frontend receives and displays
   └─> React Query caches result
   └─> Components render university cards
```

## The 8-Pillar Ranking Algorithm

**Location:** `src/backend/core/models.py`

Each university receives a score (0-100) based on 8 weighted pillars:

| Pillar | Weight | What It Measures |
|--------|--------|------------------|
| **Academic** | 20% | CGPA margin, English test scores, aptitude tests, backlogs |
| **Course** | 15% | Program alignment with student interests |
| **Reputation** | 15% | QS ranking, research output, global standing |
| **Career** | 15% | Placement rate, graduate salaries, co-op programs |
| **ROI** | 12% | Cost vs. earning potential, payback period |
| **Scholarship** | 10% | Funding availability (weighted by student preference) |
| **Location** | 8% | Country/city preference, intake alignment |
| **Visa** | 5% | Post-study work rights, visa friendliness |

**Weights adapt** based on student's stated priority (e.g., if "cost" is high priority, ROI + scholarship weights increase).

## Eligibility-First Design

**Philosophy:** Only show universities the student can actually attend.

**Hard Filters (applied before scoring):**
1. **Academic cutoff** - Student's CGPA must meet minimum
2. **English proficiency** - IELTS/TOEFL/PTE/Duolingo requirement
3. **Course availability** - University offers the desired program
4. **Degree level** - Bachelor's vs Master's vs PhD
5. **Intake availability** - Accepts students in desired term

**Result:** Users never see universities they can't get into, reducing false hope.

## Data Honesty Model

**Real Data:**
- University names, cities, URLs
- Institution types
- QS ranking bands
- Course offerings

**Synthesized Data (Deterministic):**
- Tuition fees
- Living costs
- Acceptance rates
- Graduate salaries
- Cutoff scores

**Why Synthesized?**
- Eliminates web scraping fragility
- Stable across runs (same input → same output)
- No rate limiting or API costs
- Fast local computation

**User Notice:** UI clearly states "verify on official site"

## Scalability Considerations

### Current Limitations
- In-memory data (237 universities)
- Single-server deployment
- No caching layer
- No database

### Future Enhancements
1. **Database Migration**
   - PostgreSQL for university data
   - Redis for caching
   - Elasticsearch for search

2. **Microservices**
   - Separate ranking service
   - Separate data ingestion pipeline
   - API gateway

3. **Performance**
   - Response caching
   - CDN for frontend assets
   - Load balancing

4. **AI Integration**
   - LLM-powered university descriptions
   - Conversational profile building
   - Personalized essay feedback

## Security Architecture

### Current Implementation
- **CORS** - Whitelist frontend origins
- **Input Validation** - Pydantic models
- **No Authentication** - Public API (v1.0)

### Production Requirements
1. **Authentication & Authorization**
   - JWT tokens
   - OAuth2 providers (Google, GitHub)
   - Role-based access control

2. **Rate Limiting**
   - Per-IP throttling
   - API key quotas

3. **Data Security**
   - HTTPS only
   - SQL injection prevention (when DB added)
   - XSS protection
   - CSRF tokens

4. **Monitoring**
   - Error tracking (Sentry)
   - Performance monitoring (New Relic/Datadog)
   - Audit logs

## Deployment Architecture

### Development
```
Developer Machine
├── Backend: localhost:8000
└── Frontend: localhost:3000
```

### Production (Recommended)
```
Cloud Provider (AWS/GCP/Azure)
├── Load Balancer
├── Application Servers (2+)
│   ├── FastAPI (Gunicorn + Uvicorn)
│   └── Next.js (Node.js)
├── CDN (CloudFlare/CloudFront)
└── Monitoring (Sentry, Datadog)
```

### Docker Deployment
```
docker-compose up
├── backend container (FastAPI)
├── frontend container (Next.js)
└── nginx (reverse proxy)
```

## Technology Choices Explained

### Why FastAPI?
- **Performance** - Async/await, comparable to Node.js
- **Developer Experience** - Auto-generated docs, type hints
- **Validation** - Built-in Pydantic integration
- **Modern** - Python 3.10+ features

### Why Next.js?
- **React** - Most popular UI framework
- **App Router** - Modern routing with server components
- **TypeScript** - Type safety
- **Performance** - Automatic optimization, image optimization
- **SEO** - Server-side rendering capability

### Why No AI/LLM?
- **Determinism** - Same input always produces same output
- **Speed** - No API latency
- **Cost** - No per-request charges
- **Privacy** - No data sent to third parties
- **Offline** - Works without internet (after initial load)

### Why No Database?
- **Simplicity** - Easier deployment and maintenance
- **Performance** - In-memory is faster than disk/network
- **Portability** - Single Python file contains all data
- **Version Control** - Data changes tracked in Git

**When to add a database:** >1000 universities, real-time updates needed, multi-tenancy

## Testing Strategy

### Unit Tests
- Domain logic (models.py functions)
- Utility functions (parsing, normalization)

### Integration Tests
- API endpoints
- Service layer orchestration

### End-to-End Tests
- Critical user flows (profile → search → detail)

### Performance Tests
- Response time benchmarks
- Load testing (100+ concurrent users)

## Monitoring & Observability

### Metrics to Track
- API response times
- Error rates
- Search result counts
- User profile distributions

### Logging
- Structured JSON logs
- Request/response logging
- Error stack traces

### Alerts
- API downtime
- High error rates (>5%)
- Slow responses (>2s p95)

---

**Next:** See [API.md](API.md) for detailed endpoint documentation.
