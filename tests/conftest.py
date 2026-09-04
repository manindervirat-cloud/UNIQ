"""Pytest configuration for the backend test suite.

Puts the repository root on ``sys.path`` so tests can import the backend as
``src.backend.*`` — the same import path Uvicorn uses for
``src.backend.main:app``. This keeps the tests honest: they exercise the real
package layout rather than a test-only shim.
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
