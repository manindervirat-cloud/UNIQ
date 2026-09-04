"""
Unit tests for the core domain logic in models.py
Tests the business logic layer: eligibility, ranking, parsing, conversions.
"""

import pytest
from src.backend.core.models import (
    parse_budget,
    normalize_academic,
    ielts_equivalent,
    check_eligibility,
    score_one,
    rank_all,
    pillar_weights,
    compute_admission_chance,
    StudentProfile,
    UniversityProfile,
    GRADING_SYSTEMS,
    CURRENCY_RATES_PER_USD,
    ENGLISH_TEST_RANGES,
)


class TestBudgetParsing:
    """Test budget parsing from various formats to USD."""

    def test_usd_explicit(self):
        result = parse_budget("USD 50000", "India")
        assert result.ok is True
        assert result.amount_usd == 50000.0

    def test_usd_with_comma(self):
        result = parse_budget("$60,000", "India")
        assert result.ok is True
        assert result.amount_usd == 60000.0

    def test_inr_lakh(self):
        result = parse_budget("20 lakh", "India")
        assert result.ok is True
        assert abs(result.amount_usd - 23255.8) < 10

    def test_inr_crore(self):
        result = parse_budget("1.5 crore", "India")
        assert result.ok is True
        # 1.5 crore = 15,000,000 INR, rate 86 INR/USD = $174,418
        assert abs(result.amount_usd - 174418.6) < 10

    def test_eur_explicit(self):
        result = parse_budget("EUR 30000", "Germany")
        assert result.ok is True
        assert abs(result.amount_usd - 32608.7) < 10

    def test_cad_explicit(self):
        result = parse_budget("CAD 45000", "Canada")
        assert result.ok is True
        assert abs(result.amount_usd - 32846.7) < 10

    def test_k_notation(self):
        result = parse_budget("50k", "USA")
        assert result.ok is True
        assert result.amount_usd == 50000.0

    def test_m_notation(self):
        result = parse_budget("1.2m", "USA")
        assert result.ok is True
        assert result.amount_usd == 1200000.0

    def test_plain_number_defaults_to_home_currency(self):
        result = parse_budget("100000", "India")
        assert result.ok is True
        assert abs(result.amount_usd - 1162.8) < 10

    def test_nepal_uses_npr_for_lakh(self):
        result = parse_budget("20 lakh", "Nepal")
        assert result.ok is True
        assert result.currency == "NPR"
        assert abs(result.amount_usd - 14598.5) < 10

    def test_empty_input(self):
        result = parse_budget("", "India")
        assert result.ok is False
        assert "budget" in result.error.lower()

    def test_too_low_budget(self):
        result = parse_budget("100", "India")
        assert result.ok is False
        assert "too low" in result.error.lower()

    def test_too_high_budget(self):
        result = parse_budget("100 million", "USA")
        assert result.ok is False
        assert "over $2m" in result.error.lower()


class TestAcademicNormalization:
    """Test academic score normalization to percentage equivalent."""

    def test_percentage_direct(self):
        result = normalize_academic("Percentage", "85")
        assert result.ok is True
        assert result.percent == 85.0

    def test_cgpa_10_scale(self):
        result = normalize_academic("CGPA (10-point)", "8.5")
        assert result.ok is True
        assert abs(result.percent - 80.75) < 1

    def test_cgpa_4_scale(self):
        result = normalize_academic("GPA (4-point)", "3.5")
        assert result.ok is True
        assert abs(result.percent - 87.5) < 1

    def test_invalid_system(self):
        result = normalize_academic("Invalid System", "85")
        assert result.ok is False

    def test_empty_input(self):
        result = normalize_academic("Percentage", "")
        assert result.ok is False

    def test_non_numeric(self):
        result = normalize_academic("Percentage", "abc")
        assert result.ok is False

    def test_percentage_out_of_range(self):
        result = normalize_academic("Percentage", "150")
        assert result.ok is False

    def test_cgpa_out_of_range(self):
        result = normalize_academic("CGPA (10-point)", "11")
        assert result.ok is False

    def test_gpa_out_of_range(self):
        result = normalize_academic("GPA (4-point)", "5.0")
        assert result.ok is False

    def test_cgpa_looks_like_percentage_rejected(self):
        result = normalize_academic("Percentage", "8.5")
        assert result.ok is False
        assert "CGPA/GPA" in result.error

    def test_percentage_looks_like_cgpa_rejected(self):
        result = normalize_academic("CGPA (10-point)", "85")
        assert result.ok is False
        assert "percentage" in result.error.lower()