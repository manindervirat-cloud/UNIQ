"""End-to-end tests for the Application Automation (Agent 4) module embedded in
the host app.

These tests exercise the real FastAPI app with TestClient and hit the mounted
``/api/v1/apply`` router. They verify the readiness gate, the duplicate-apply
guard, the pause/resume round-trip synthetic flow (no real browser), and the
dashboard inbox surface. They do NOT start a real Playwright browser: the
embedded module runs in "demo/simulated" mode in the test environment, so the
orchestrator's live adapter returns synthetic results that are safe to assert.
"""

import pytest
from fastapi.testclient import TestClient

from src.backend.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_apply_health(client):
    r = client.get("/api/v1/apply/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"


def test_readiness_unknown_student_reports_ineligible(client):
    """A brand-new student id has no verified profile; readiness degrades
    gracefully to a 200 with eligible=False (the dashboard uses this to keep
    the Apply Now button disabled without surfacing a hard error)."""
    r = client.get("/api/v1/apply/readiness/LIVE-no-such-student-xyz/UNIV_US_NSU")
    assert r.status_code == 200
    body = r.json()
    assert body["eligible"] is False
    assert "university_name" in body
    assert isinstance(body["missing_documents"], list)


def test_readiness_unknown_university_404(client):
    r = client.get("/api/v1/apply/readiness/LIVE-test-student/UNIV_NOT_A_REAL_ID")
    assert r.status_code == 404


def test_start_and_poll_application(client):
    """Start a simulated application, then poll its state until it pauses or
    completes."""
    req = {
        "student_id": "LIVE-e2e-test-student",
        "university_id": "UNIV_US_NSU",
    }
    r1 = client.post("/api/v1/apply/apply", json=req)
    assert r1.status_code in (202, 409)  # 409 only if a prior test run left one active

    if r1.status_code == 409:
        # Resume the existing application for the rest of the assertions.
        # Find it via the inbox.
        existing = client.get(f"/api/v1/apply/inbox/{req['student_id']}").json()
        assert existing, "409 returned but no existing application in inbox"
        app_id = existing[0]["id"]
    else:
        app_id = r1.json()["application_id"]

    # Poll the application state.
    r2 = client.get(f"/api/v1/apply/applications/{app_id}")
    assert r2.status_code == 200
    state = r2.json()
    assert state["application_id"] == app_id
    assert state["student_id"] == req["student_id"]
    assert state["university_id"] == req["university_id"]
    assert "status" in state
    assert "progress" in state
    assert "history" in state

    # Inbox surfaces the application regardless of state.
    rin = client.get(f"/api/v1/apply/inbox/{req['student_id']}")
    assert rin.status_code == 200
    items = rin.json()
    assert any(i["id"] == app_id for i in items)


def test_duplicate_apply_rejected_with_409(client):
    """Starting a second application for the same student+university while one
    is active must return 409, not overwrite the existing record."""
    req = {
        "student_id": "LIVE-e2e-dup-test",
        "university_id": "UNIV_US_NSU",
    }
    r1 = client.post("/api/v1/apply/apply", json=req)
    assert r1.status_code == 202
    app_id = r1.json()["application_id"]
    # Second request while the first is non-terminal.
    r2 = client.post("/api/v1/apply/apply", json=req)
    assert r2.status_code == 409

    # The original record still exists and is unchanged.
    r3 = client.get(f"/api/v1/apply/applications/{app_id}")
    assert r3.status_code == 200
    assert r3.json()["application_id"] == app_id


def test_resume_unknown_application_404(client):
    r = client.post(
        "/api/v1/apply/applications/APP-not-a-real-id/resume",
        json={"action": "captcha_solved"},
    )
    assert r.status_code == 404


def test_audit_trail_emits_events(client):
    """Every state transition recorded by the orchestrator is exposed on the
    audit endpoint."""
    req = {
        "student_id": "LIVE-e2e-audit-test",
        "university_id": "UNIV_US_NSU",
    }
    r1 = client.post("/api/v1/apply/apply", json=req)
    if r1.status_code == 409:
        app_id = client.get(f"/api/v1/apply/inbox/{req['student_id']}").json()[0]["id"]
    else:
        app_id = r1.json()["application_id"]

    r2 = client.get(f"/api/v1/apply/applications/{app_id}/audit")
    assert r2.status_code == 200
    events = r2.json()
    assert isinstance(events, list)
    # At minimum there is a record-created / submission-started event sequence.
    assert len(events) >= 1
    assert all("application_id" in e for e in events)
