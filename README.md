# Study Abroad AI Platform

An eligibility-first university counselor: real admission requirements are
checked **before** anything is ranked. Next.js frontend + FastAPI backend
over an unchanged Python domain layer (`models.py`, `university_database.py`).

## Features

- **Eligibility-first search** — admission requirements are checked before ranking; ineligible universities never receive a fit score
- **Fit scores, roadmaps & compare** — per-university admission roadmaps, side-by-side comparison of shortlisted options
- **SOP generator** — AI-written (OpenAI) or offline template Statement of Purpose drafts with version history, generated from a short student questionnaire
- **Document verification** — checks required admission documents against the target university
- **Application automation tracker** — guided apply workflow with step state, retries and an audit trail
- **Answer persistence** — student answers persist in the browser (localStorage); "Start over" is the only thing that clears them

## Requirements

- **Python 3.10+** (backend)
- **Node.js 18.17+** (with npm) for the frontend
- Windows for the one-click scripts; everything also runs from the manual commands below on any OS
- Optional: an OpenAI API key for AI-written SOPs (without it the SOP generator falls back to an offline template draft)

## Architecture

```
study-abroad-ai/              # repo root
├── src/                      # Python backend source
│   └── backend/              # FastAPI application
│       ├── api/              #   routes + middleware (HTTP layer)
│       ├── services/         #   JSON adapters over the domain layer
│       ├── core/             #   domain models + university database (framework-free)
│       ├── config/           #   environment settings
│       └── main.py           #   entry point (uvicorn src.backend.main:app)
├── frontend/                 # Next.js 14 (App Router) + TS + Tailwind
│   └── src/
│       ├── app/              #   pages: / (profile), /results, /university/[key], /compare
│       ├── components/       #   ui primitives, result cards, roadmap, media hub
│       ├── hooks/            #   useProfile (localStorage persistence)
│       ├── lib/              #   typed API client, utils
│       └── types/            #   API types (mirror backend serialization)
├── tests/                    # pytest suite
│   └── backend/              #   backend smoke + wiring tests
├── docs/                     # Documentation (see docs/README.md)
│   ├── ARCHITECTURE.md       #   system design
│   ├── API.md                #   endpoint reference
│   ├── guides/               #   onboarding guides
│   └── reports/              #   historical engineering records
├── scripts/                  # Startup scripts (Windows)
├── START_HERE.bat            # One-click setup & launch (Windows)
├── requirements.txt          # Backend Python dependencies
├── requirements-dev.txt      # Test & lint tooling
├── pytest.ini                # Test configuration
└── .env.example              # Environment configuration template
```

## Running

### Easiest: one double-click (Windows)

Double-click **`START_HERE.bat`** in the root folder. It will:

1. Check Node.js is installed (and open nodejs.org for you if it isn't — install the LTS once, then run it again)
2. Install backend + frontend dependencies automatically (first run only)
3. Start both servers in their own windows and open http://localhost:3000

Close both server windows to stop the app.

### Manual (two terminals)

**1 — Backend** (Python 3.10+):

```bash
pip install -r requirements.txt
uvicorn src.backend.main:app --port 8000
```

> Avoid `--reload` here: this project sits in a Dropbox-synced folder, and the
> reloader restarts the server every time Dropbox touches a file, which shows up
> in the app as intermittent "Connection problem" errors.

**2 — Frontend** (Node.js 18.17+):

```bash
cd frontend
npm install
npm run build && npm start
```

Open http://localhost:3000. The frontend proxies `/api/*` to the backend
(configure a different backend origin in `.env` → `NEXT_PUBLIC_API_URL` or `API_ORIGIN`).

`npm run dev` is available for frontend development, but prefer
`npm run build && npm start` in this folder — the dev server's file watcher is
also disrupted by Dropbox sync.

## Tests

```bash
pip install -r requirements-dev.txt
pytest
```

## Environment setup

The app runs with no environment variables at all. To enable AI-written SOPs:

1. Copy the root `.env.example` to `.env`
2. Paste your OpenAI API key into `OPENAI_API_KEY`
3. Restart the backend

Never commit `.env` (it is git-ignored) and never expose the key to the
browser via a `NEXT_PUBLIC_` variable. See `.env.example` for all options.

## Security notes

- `.env` (secrets) is git-ignored; `.env.example` documents every variable with safe placeholders
- The frontend only ever talks to the same origin — it proxies `/api/*` to the backend, so no API key reaches the browser
- The SOP module falls back to an offline template draft when no key is configured — no secret required to run

## Production build

```bash
cd frontend && npm run build && npm start   # frontend on :3000
uvicorn src.backend.main:app --port 8000    # backend
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design, layers, ranking model
- [docs/API.md](docs/API.md) — endpoint reference
- [docs/README.md](docs/README.md) — full documentation index

## Notes

- Student answers persist in the browser (localStorage) — navigation and
  reloads never lose data. "Start over" is the only thing that clears it.
- Honest-by-design: ineligible universities receive **no** fit score;
  over-budget options are labelled "Academically suitable, exceeds your
  stated budget"; missing ranks show "Not Available".

## License

No license is currently included. If you intend for others to reuse this
code, add a LICENSE file (e.g. MIT) — until then, default copyright applies.
