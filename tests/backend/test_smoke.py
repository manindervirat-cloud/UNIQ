"""Smoke tests for the backend.

These are deliberately shallow: they assert that the application wires itself
together and that the domain layer loads, without asserting on ranking
outcomes. Their job is to fail loudly if the package layout, imports, or route
registration break — for example after files are moved.
"""

from fastapi.testclient import TestClient

from src.backend.core.database import DATA_VERSION
from src.backend.core.models import UNIVERSITY_DB
from src.backend.main import app
from src.backend.services import university_service

# Every core endpoint the frontend depends on, as (method, path). These are the
# host's OWN routes, declared directly on `app` in src/backend/api/routes.py, so
# they are always materialized in app.routes.
EXPECTED_ROUTES = {
    ("GET", "/api/health"),
    ("GET", "/api/meta"),
    ("POST", "/api/validate"),
    ("POST", "/api/search"),
    ("POST", "/api/university/{key}"),
    ("POST", "/api/university/{key}/roadmap"),
    ("POST", "/api/rerank"),
    ("POST", "/api/compare"),
}

# Embedded micro-module mount health paths (SOP, Document Verification,
# Application Automation). These packages are self-contained; we assert only
# that each is MOUNTED by issuing a real GET to its health endpoint.
#
# NOTE: these CANNOT be asserted via app.routes. The installed FastAPI version
# mounts routers lazily: include_router() stores an opaque _IncludedRouter
# wrapper in app.routes rather than flattening each sub-route to an APIRoute, so
# a route-table walk never sees /api/v1/* (only request dispatch resolves them).
# Asserting on real requests tests the behaviour that actually matters.
EMBEDDED_HEALTH_PATHS = (
    "/api/v1/sop/health",
    "/api/v1/verify/health",
    "/api/v1/apply/health",
)


def _registered_routes():
    """Collect (method, path) pairs from the FastAPI app."""
    found = set()
    for route in app.routes:
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", None) or ()
        if path is None:
            continue
        for method in methods:
            if method in {"HEAD", "OPTIONS"}:
                continue
            found.add((method, path))
    return found


class TestApplicationWiring:
    def test_app_imports(self):
        """The ASGI app Uvicorn loads must be importable as src.backend.main:app."""
        assert app is not None

    def test_all_expected_routes_registered(self):
        assert EXPECTED_ROUTES <= _registered_routes()

    def test_embedded_modules_are_mounted(self):
        """Each embedded module (SOP, Verify, Apply) must answer its health
        endpoint over HTTP. This exercises real routing — including the lazy
        route resolution that app.routes introspection cannot see."""
        client = TestClient(app)
        for path in EMBEDDED_HEALTH_PATHS:
            resp = client.get(path)
            assert resp.status_code == 200, f"{path} -> {resp.status_code}"

    def test_no_unexpected_core_routes(self):
        """The stable core surface (/api/*, excluding embedded /api/v1/* modules)
        must not gain endpoints by accident. Embedded modules under /api/v1/ are
        free to add sub-routes, so they are excluded from this exact-equality
        check and guarded separately by their health-mount assertion above."""
        core_routes = {
            r
            for r in _registered_routes()
            if r[1].startswith("/api") and not r[1].startswith("/api/v1/")
        }
        assert core_routes == EXPECTED_ROUTES


class TestDomainLayer:
    def test_university_database_is_populated(self):
        assert len(UNIVERSITY_DB) > 0

    def test_data_version_is_set(self):
        assert isinstance(DATA_VERSION, str) and DATA_VERSION


class TestServiceLayer:
    def test_meta_exposes_form_data(self):
        """/api/meta feeds every dropdown in the profile wizard."""
        meta = university_service.get_meta()
        for key in (
            "countries",
            "courses",
            "degreeLevels",
            "englishTests",
            "aptitudeTests",
            "pillars",
            "dataVersion",
        ):
            assert key in meta, f"meta missing {key!r}"

    def test_service_exposes_public_operations(self):
        for op in (
            "get_meta",
            "validate_profile",
            "search",
            "university_detail",
            "admission_roadmap",
            "rerank",
            "compare",
        ):
            assert callable(getattr(university_service, op))
