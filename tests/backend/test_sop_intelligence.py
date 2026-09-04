"""Agent-2 (SOP intelligence engine) upgrade tests.

Covers the new layers end-to-end at two levels:
  - unit: knowledge retrieval, adaptive interview, evidence extraction,
    blueprint adaptation, critic scoring, fact checking, version store;
  - integration: the real FastAPI app answering the new endpoints.
"""

import tempfile

import pytest
from fastapi.testclient import TestClient

from src.backend.main import app
from src.backend.modules.sop.config.settings import Settings
from src.backend.modules.sop.domain.models import StudentAnswers, UniversityTarget
from src.backend.modules.sop.services import (
    blueprint as blueprint_service,
)
from src.backend.modules.sop.services import (
    critic as critic_service,
)
from src.backend.modules.sop.services import (
    evidence as evidence_service,
)
from src.backend.modules.sop.services import (
    factcheck as factcheck_service,
)
from src.backend.modules.sop.services import (
    interview as interview_service,
)
from src.backend.modules.sop.services import (
    knowledge as knowledge_service,
)
from src.backend.modules.sop.services.sop_service import GenerationOptions, SOPService
from src.backend.modules.sop.services.versions import VersionStore

TARGET = UniversityTarget(
    university_name="University of Toronto",
    course_name="MSc Computer Science",
    degree_level="masters",
)

RICH_ANSWERS = StudentAnswers(
    full_name="Asha Rao",
    current_education="B.Tech Computer Science, VIT Vellore, 2024, CGPA 8.9",
    academic_achievements="Top 5% of my batch; won the university hackathon in 2023",
    why_this_field="I became interested in AI after building a chatbot for my college helpdesk",
    why_this_university="The machine learning group's work on retrieval systems matches my project experience",
    work_experience=(
        "Software engineering intern at Zeta during summer 2023. The billing service "
        "often produced irrelevant notifications. I redesigned the event filtering logic "
        "and reduced false alerts by 40%. This taught me that data quality matters more "
        "than model complexity."
    ),
    research_or_projects=(
        "Built a retrieval-augmented chatbot for the campus helpdesk. Responses were often "
        "irrelevant because of poor context handling. I implemented a hybrid keyword-vector "
        "retrieval pipeline and improved answer relevance by 35% on our evaluation set."
    ),
    career_goals_short_term="ML engineer role in industry",
    career_goals_long_term="Lead applied ML teams building retrieval systems",
)


class TestKnowledgeBase:
    def test_retrieval_matches_tags(self):
        items = knowledge_service.retrieve_guidance(["structure", "evidence"])
        assert items, "no knowledge retrieved"
        assert all("guidance" in i for i in items)

    def test_digest_is_bounded_and_attributed(self):
        digest = knowledge_service.guidance_digest(["structure"])
        assert "[structure-four-questions]" in digest
        assert len(digest.splitlines()) <= 12


class TestAdaptiveInterview:
    def test_rich_profile_yields_few_questions(self):
        plan = interview_service.plan_interview(RICH_ANSWERS, TARGET)
        known_keys = {k["key"] for k in plan["known"]}
        assert "full_name" in known_keys and "research_or_projects" in known_keys
        asked = {q["key"] for q in plan["questions"]}
        assert "full_name" not in asked
        assert "current_education" not in asked
        assert len(plan["questions"]) < 8

    def test_blank_profile_yields_more_questions(self):
        plan = interview_service.plan_interview(StudentAnswers(), TARGET)
        assert len(plan["questions"]) >= 6
        required_first = plan["questions"][0]
        assert required_first["importance"] == "required"

    def test_questions_carry_ui_types_and_skip_flags(self):
        plan = interview_service.plan_interview(StudentAnswers(), TARGET)
        uis = {q["key"]: q["ui"] for q in plan["questions"]}
        if "why_this_field" in uis:
            assert uis["why_this_field"] == "single_select"
        for q in plan["questions"]:
            if q["importance"] != "required":
                assert q["skippable"] is True

    def test_followup_probes_project_mention(self):
        fu = interview_service.suggest_followup(
            "why_this_field",
            "I became interested in AI after I built a chatbot for my college helpdesk",
            RICH_ANSWERS,
        )
        assert fu is not None and "problem" in fu["question"].lower()

    def test_followup_catches_gerund_project_mentions(self):
        # Regression: "building/developing a ..." used to miss the cue list
        # (only exact "built" matched), so real student phrasings got no probe.
        for answer in (
            "I became interested in AI after building a chatbot for my fest",
            "Developing a small expense tracker made me love software",
        ):
            fu = interview_service.suggest_followup(
                "why_this_field", answer, RICH_ANSWERS
            )
            assert fu is not None and "problem" in fu["question"].lower(), answer

    def test_followup_asks_outcome_when_missing(self):
        fu = interview_service.suggest_followup(
            "work_experience", "I interned at a startup last year.", RICH_ANSWERS
        )
        assert fu is not None and "outcome" in fu["key"]

    def test_thin_answer_gets_detail_request(self):
        fu = interview_service.suggest_followup(
            "unique_strengths", "hard working", RICH_ANSWERS
        )
        assert fu is not None and fu["skippable"]


class TestEvidenceEngine:
    def test_extraction_fills_par_slots(self):
        profile = evidence_service.extract_evidence(RICH_ANSWERS)
        themes = [e.theme for e in profile.entries]
        assert "Internship / Work" in themes and "Project / Research" in themes
        work = next(e for e in profile.entries if e.theme == "Internship / Work")
        assert work.result and work.learning

    def test_coverage_detects_dropped_experiences(self):
        profile = evidence_service.extract_evidence(RICH_ANSWERS)
        full_text = RICH_ANSWERS.work_experience + " " + RICH_ANSWERS.research_or_projects
        assert evidence_service.evidence_coverage(profile, full_text) > 0.5
        assert evidence_service.evidence_coverage(
            profile, "A completely unrelated essay about nothing."
        ) < 0.6


class TestBlueprint:
    def _build(self, target, answers=RICH_ANSWERS):
        return blueprint_service.build_blueprint(target, answers, None, 1000)

    def test_masters_vs_phd_adapt(self):
        masters = self._build(TARGET)
        phd_target = UniversityTarget(
            university_name="MIT", course_name="PhD in Computer Science",
            degree_level="phd",
        )
        phd = self._build(phd_target)
        assert masters.document_type == "masters_sop"
        assert phd.document_type == "phd_research"
        phd_sections = {s.name for s in phd.sections}
        assert "Research agenda" in phd_sections
        assert "Research agenda" not in {s.name for s in masters.sections}

    def test_word_budgets_sum_to_target(self):
        bp = self._build(TARGET)
        total = sum(s.approx_words for s in bp.sections)
        assert abs(total - 1000) <= 60

    def test_scholarship_detection(self):
        t = UniversityTarget(
            university_name="Oxford", course_name="MSc Data Science",
            specific_prompt="Statement of purpose and scholarship essay",
        )
        assert blueprint_service.detect_document_type(t) == "scholarship_statement"


class TestCritic:
    def test_specific_draft_beats_generic_one(self):
        specific = (
            "My interest in retrieval systems started when the campus helpdesk chatbot "
            "kept returning irrelevant answers in 2023. At Zeta, I redesigned the event "
            "filtering logic and cut false alerts by 40%. The University of Toronto's "
            "machine learning group works on exactly these retrieval problems, and my "
            "goal is to build production retrieval systems after graduating."
        )
        generic = (
            "Ever since I was a child I have always been passionate about technology. "
            "It is worth noting that your world-class university would unlock my potential. "
            "I want to delve into cutting-edge research and broaden my horizons."
        )
        good = critic_service.assess(specific, TARGET, placeholder_count=0)
        bad = critic_service.assess(generic, TARGET, placeholder_count=2)
        assert good.overall > bad.overall
        assert len({d.name for d in bad.dimensions}) == 8

    def test_overall_is_bounded_and_verdict_labeled(self):
        report = critic_service.assess(
            "Some text about goals and career plans after graduation.", TARGET
        )
        assert 0 <= report.overall <= 100
        assert report.verdict in {
            "Strong", "Good", "Needs work",
            "Weak draft -- regenerate with more student input",
        }

    def test_weaknesses_drive_a_revision_instruction(self):
        report = critic_service.assess(
            "I want to delve into cutting-edge research at your esteemed faculty.",
            TARGET,
        )
        instruction = critic_service.revision_instruction(report)
        assert "Improve only these specific problems" in instruction


class TestFactCheck:
    def test_invented_year_flagged(self):
        report = factcheck_service.check_facts(
            "In 1997 I first saw a computer. At University of Toronto I will study AI.",
            RICH_ANSWERS, TARGET,
        )
        claims = {i.claim for i in report.issues}
        assert any(c == "1997" for c in claims)

    def test_grade_contradiction_flagged(self):
        sop = ("My CGPA was 6.2 during my bachelor's. I look forward to studying at "
               "Toronto.")
        report = factcheck_service.check_facts(sop, RICH_ANSWERS, TARGET)
        assert not report.passed
        assert any(i.type == "contradiction" for i in report.issues)

    def test_clean_consistent_draft_passes(self):
        sop = (
            "During my B.Tech at VIT I maintained a CGPA of 8.9 while building a "
            "retrieval chatbot in 2023. My internship at Zeta taught me data quality. "
            "At the University of Toronto I want to deepen this work."
        )
        report = factcheck_service.check_facts(sop, RICH_ANSWERS, TARGET)
        assert report.passed

    def test_sentence_starters_and_titles_not_flagged(self):
        # Regression: 'What'/'Looking' open sentences, 'Statement' is the doc title.
        sop = (
            "Statement of Purpose\n\nWhat drives me is retrieval research. "
            "Looking back, my project at Zeta shaped this goal. "
            "I hope to join the University of Toronto."
        )
        claims = {i.claim for i in factcheck_service.check_facts(sop, RICH_ANSWERS, TARGET).issues}
        assert not any(c in {"What", "Looking", "Statement"} for c in claims)

    def test_generic_field_names_not_flagged(self):
        sop = "I want to study Artificial Intelligence and Machine Learning at Toronto after my B.Tech."
        claims = {i.claim for i in factcheck_service.check_facts(sop, RICH_ANSWERS, TARGET).issues}
        assert not any("Artificial" in c or "Machine" in c for c in claims)

    def test_target_university_words_not_flagged(self):
        # 'Karlsruhe Institute' comes straight from the target university name.
        target = UniversityTarget(
            university_name="Karlsruhe Institute of Technology",
            course_name="MSc Computer Science",
        )
        sop = "My goal is to pursue the MSc programme at Karlsruhe Institute of Technology."
        claims = {i.claim for i in factcheck_service.check_facts(sop, RICH_ANSWERS, target).issues}
        assert not any("Karlsruhe" in c for c in claims)

    def test_unknown_entity_still_flagged(self):
        sop = "I interned at Acme Corporation, where the Zephyr team built compilers."
        claims = {i.claim for i in factcheck_service.check_facts(sop, RICH_ANSWERS, TARGET).issues}
        assert any("Acme" in c or "Zephyr" in c for c in claims)


class TestVersionStore:
    def test_save_list_get_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = VersionStore(tmp)
            first = store.save(
                student_name="Asha Rao",
                university_name=TARGET.university_name,
                course_name=TARGET.course_name,
                sop_text="Draft one.",
                key_points=["kp1"],
                instruction=None,
                overall_score=61,
            )
            second = store.save(
                student_name="Asha Rao",
                university_name=TARGET.university_name,
                course_name=TARGET.course_name,
                sop_text="Draft two, improved.",
                key_points=[],
                instruction="make it stronger",
                overall_score=74,
            )
            listed = store.list("Asha Rao", TARGET.university_name, TARGET.course_name)
            assert [v["version_id"] for v in listed] == [
                first.version_id, second.version_id
            ]
            fetched = store.get("Asha Rao", TARGET.university_name,
                                TARGET.course_name, first.version_id)
            assert fetched["sop_text"] == "Draft one."

    def test_different_students_are_isolated(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = VersionStore(tmp)
            store.save("Alice", "U", "C", "alice draft", [])
            assert store.list("Bob", "U", "C") == []


def _service(tmp_root: str) -> SOPService:
    settings = Settings(OPENAI_API_KEY=None)  # template mode, deterministic
    settings.versions_dir = tmp_root
    return SOPService(settings)


class TestServiceIntegration:
    def test_generate_template_mode_attaches_intelligence(self, tmp_path):
        service = _service(str(tmp_path))
        outcome = service.generate(
            TARGET, RICH_ANSWERS,
            options=GenerationOptions(research=False),
            insights=None,
        )
        assert outcome.draft.generated_with_ai is False
        assert outcome.blueprint is not None
        assert outcome.blueprint.document_type == "masters_sop"
        assert outcome.critic_report is not None
        assert 0 <= outcome.critic_report.overall <= 100
        assert outcome.fact_check is not None
        assert outcome.saved_version is not None


class TestNewEndpointsOverHttp:
    def test_new_endpoints_answer_over_http(self):
        client = TestClient(app)

        resp = client.post("/api/v1/sop/interview/start", json={
            "answers": {"full_name": "Asha Rao"},
            "target": {"university_name": TARGET.university_name,
                       "course_name": TARGET.course_name},
        })
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["can_generate"] is True
        assert any(q["key"] != "full_name" for q in body["questions"])

        resp = client.post("/api/v1/sop/interview/followup", json={
            "answers": {},
            "key": "why_this_field",
            "answer": "I became interested in AI after I built a chatbot",
        })
        assert resp.status_code == 200
        assert resp.json()["follow_up"] is not None

        resp = client.post("/api/v1/sop/evidence", json={
            "answers": {"work_experience": RICH_ANSWERS.work_experience},
        })
        assert resp.status_code == 200
        assert resp.json()["entries"][0]["theme"] == "Internship / Work"

        resp = client.post("/api/v1/sop/critique", json={
            "sop_text": "Generic passionate essay about your esteemed institution.",
            "target": {"university_name": TARGET.university_name,
                       "course_name": TARGET.course_name},
            "answers": {"full_name": "Asha Rao"},
        })
        assert resp.status_code == 200
        assert 0 <= resp.json()["overall"] <= 100

        resp = client.get("/api/v1/sop/versions", params={
            "student_name": "Nobody Here",
            "university_name": TARGET.university_name,
            "course_name": TARGET.course_name,
        })
        assert resp.status_code == 200
        assert resp.json() == []


class TestResearchVerification:
    """Structured research statuses + verified-entity extraction (Part A)."""

    def _research_module(self):
        from src.backend.modules.sop.services import research as research_service
        return research_service

    def test_search_failure_yields_structured_status_without_raw_error(self, monkeypatch):
        rs = self._research_module()

        class BoomBackend:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def text(self, query, max_results):
                raise ConnectionError("error sending request for url http://example.com")

        monkeypatch.setattr(rs, "_load_search_backend", lambda: BoomBackend)
        insights = rs.research_university(TARGET, enabled=True)
        assert insights.research_status in {"failed", "timeout"}
        # The raw exception text must never land in any student-visible field.
        assert "error sending request" not in insights.research_notes
        assert not insights.used_live_research

    def test_disabled_and_skipped_statuses(self, monkeypatch):
        rs = self._research_module()
        disabled = rs.research_university(TARGET, enabled=False)
        assert disabled.research_status == "disabled"

        monkeypatch.setattr(rs, "_load_search_backend", lambda: None)
        skipped = rs.research_university(TARGET, enabled=True)
        assert skipped.research_status == "skipped"
        assert not skipped.used_live_research

    def test_extract_verified_entities(self):
        rs = self._research_module()
        page = (
            "Graduate students often join the Vector Institute during their degree. "
            "The department collaborates with the Stanford AI Lab on retrieval."
        )
        entities = rs.extract_verified_entities(page, TARGET)
        joined = " | ".join(entities)
        assert "Vector Institute" in joined
        assert "Stanford AI Lab" in joined

    def test_verified_entity_not_flagged_by_factcheck(self):
        sop = "I interned at Acme Corporation, where the Zephyr team built compilers."
        base = factcheck_service.check_facts(sop, RICH_ANSWERS, TARGET)
        assert any("Acme" in i.claim or "Zephyr" in i.claim for i in base.issues)
        clean = factcheck_service.check_facts(
            sop, RICH_ANSWERS, TARGET,
            verified_entities={"Acme Corporation", "Zephyr"},
        )
        assert not any("Acme" in i.claim or "Zephyr" in i.claim for i in clean.issues)

    # -- Phase 24: intentional-failure matrix --------------------------------

    def test_search_timeout_yields_timeout_status(self, monkeypatch):
        rs = self._research_module()

        class SlowBackend:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def text(self, query, max_results):
                raise TimeoutError("The read operation timed out")

        monkeypatch.setattr(rs, "_load_search_backend", lambda: SlowBackend)
        insights = rs.research_university(TARGET, enabled=True)
        assert insights.research_status == "timeout"
        assert not insights.used_live_research
        assert "timed out" not in insights.research_notes.lower()

    def test_empty_search_results_yields_no_results_status(self, monkeypatch):
        rs = self._research_module()

        class EmptyBackend:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def text(self, query, max_results):
                return iter(())

        monkeypatch.setattr(rs, "_load_search_backend", lambda: EmptyBackend)
        insights = rs.research_university(TARGET, enabled=True)
        assert insights.research_status == "no_results"
        assert not insights.used_live_research

    def test_fetch_page_text_rejects_non_http_schemes(self):
        rs = self._research_module()
        for bad in ("file:///etc/passwd", "ftp://example.com/x", "javascript:alert(1)"):
            with pytest.raises(ValueError):
                rs.fetch_page_text(bad)

    def test_fetch_page_text_returns_empty_for_non_html(self, monkeypatch):
        rs = self._research_module()
        import requests as requests_lib

        class FakeResponse:
            status_code = 200
            headers = {"Content-Type": "application/pdf"}
            text = "%PDF-1.4 binary"

            def raise_for_status(self):
                return None

        calls = []

        def fake_get(url, **kwargs):
            calls.append(url)
            return FakeResponse()

        monkeypatch.setattr(requests_lib, "get", fake_get)
        assert rs.fetch_page_text("https://university.edu/brochure.pdf") == ""
        assert len(calls) == 1  # no retry wasted on a deterministic non-error

    def test_fetch_page_text_does_not_retry_http_errors(self, monkeypatch):
        rs = self._research_module()
        import requests as requests_lib

        attempts = []

        def fake_get(url, **kwargs):
            attempts.append(url)
            resp = requests_lib.Response()
            resp.status_code = 404
            raise requests_lib.exceptions.HTTPError("404 Client Error")

        monkeypatch.setattr(requests_lib, "get", fake_get)
        with pytest.raises(requests_lib.exceptions.HTTPError):
            rs.fetch_page_text("https://university.edu/missing")
        assert len(attempts) == 1  # 4xx is deterministic: never retried


class TestWarningPolicy:
    """No internal tool failures or fact-check diagnostics reach students."""

    def test_generate_warnings_stay_student_safe(self, tmp_path):
        service = _service(str(tmp_path))
        outcome = service.generate(
            TARGET, RICH_ANSWERS,
            options=GenerationOptions(research=False),
        )
        banned = (
            "Web search",
            "error sending request",
            "Fact check (",
            "isn't in anything you told us",
            "Traceback",
            "Exception",
        )
        joined = "\n".join(outcome.warnings)
        for fragment in banned:
            assert fragment not in joined, f"leaked: {fragment}"
        assert outcome.research_status == "disabled"

    def test_research_status_reaches_the_api_response(self):
        client = TestClient(app)
        resp = client.post("/api/v1/sop/generate", json={
            "answers": {
                "full_name": "Asha Rao",
                "current_education": "B.Tech Computer Science, 2024",
                "why_this_field": "Built a chatbot and loved it",
                "career_goals_short_term": "ML engineer",
            },
            "target": {
                "university_name": TARGET.university_name,
                "course_name": TARGET.course_name,
            },
            "options": {"research": False},
        })
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["research_status"] == "disabled"
        assert body.get("debug_diagnostics") is None





