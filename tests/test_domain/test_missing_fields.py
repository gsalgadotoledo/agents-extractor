"""Missing fields computation tests."""
from __future__ import annotations

from submission_platform.domain.missing_fields import compute_missing_fields


class TestMissingFieldsEmpty:
    def test_none_data(self):
        result = compute_missing_fields(None)
        assert result["completion_pct"] == 0.0
        assert result["total_required"] > 0
        assert result["filled_fields"] == 0

    def test_empty_dict(self):
        result = compute_missing_fields({})
        assert result["completion_pct"] == 0.0
        assert not result["has_facilities"]
        assert not result["has_loss_runs"]


class TestMissingFieldsPartial:
    def test_some_fields_filled(self):
        data = {
            "overview": {"insured_name": "Acme Corp", "business_type": "LLC", "fein": "12-3456789"},
            "broker": {"name": "John", "email": "john@broker.com"},
            "coverage": {},
        }
        result = compute_missing_fields(data)
        assert result["filled_fields"] > 0
        assert result["completion_pct"] > 0
        assert result["completion_pct"] < 1.0
        # Coverage fields should be in required_missing
        req_paths = [f["path"] for f in result["required_missing"]]
        assert "coverage.policy_type" in req_paths
        assert "coverage.effective_date" in req_paths

    def test_facilities_detection(self):
        data = {"facilities": [{"address": "123 Main St"}]}
        result = compute_missing_fields(data)
        assert result["has_facilities"] is True

    def test_no_facilities(self):
        data = {"facilities": []}
        result = compute_missing_fields(data)
        assert result["has_facilities"] is False

    def test_loss_runs_detection(self):
        data = {"loss_runs": {"present": True, "years_covered": 4}}
        result = compute_missing_fields(data)
        assert result["has_loss_runs"] is True

    def test_no_loss_runs(self):
        data = {"loss_runs": {"present": False}}
        result = compute_missing_fields(data)
        assert result["has_loss_runs"] is False


class TestMissingFieldsComplete:
    def test_all_fields_filled(self):
        data = {
            "overview": {
                "insured_name": "Acme", "dba": "Acme Co", "fein": "12-345",
                "business_type": "LLC", "year_established": "2020",
                "number_of_employees": "50", "annual_revenue": "$5M",
                "description_of_operations": "Stuff", "sic_code": "1234", "naics_code": "5678",
            },
            "broker": {"name": "Jane", "email": "jane@b.com", "company": "Brokerage", "phone": "555-1234"},
            "coverage": {
                "policy_type": "GL", "effective_date": "01/01/2026", "expiration_date": "01/01/2027",
                "each_occurrence_limit": "$1M", "general_aggregate": "$2M",
                "products_completed_ops": "$2M", "personal_advertising_injury": "$1M",
                "fire_damage": "$100K", "medical_expense": "$10K",
            },
            "prior_insurance": {"carrier": "Old Co", "policy_number": "POL-123", "premium": "$15K"},
        }
        result = compute_missing_fields(data)
        assert result["completion_pct"] == 1.0
        assert result["total_required"] == 0
        assert result["total_recommended"] == 0

    def test_field_status_has_correct_structure(self):
        data = {"overview": {"insured_name": "Test"}}
        result = compute_missing_fields(data)
        for f in result["fields"]:
            assert "path" in f
            assert "label" in f
            assert "section" in f
            assert "required" in f
            assert "filled" in f
