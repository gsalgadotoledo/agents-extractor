"""Deduplication heuristic tests."""
from __future__ import annotations

from pathlib import Path

import pytest

from submission_platform.domain.dedup import _heuristic_dedup
from submission_platform.domain.models import Submission
from submission_platform.infra.json_store import JsonStore


@pytest.fixture
def store(tmp_path: Path) -> JsonStore:
    return JsonStore(base_dir=tmp_path)


def _make_sub(store: JsonStore, email: str, subject: str, insured: str = "") -> Submission:
    sub = Submission(broker_email=email, subject=subject, body_text="Body")
    if insured:
        sub.extracted_data = {"overview": {"insured_name": insured}}
    store.save("submissions", sub.id, sub)
    return sub


class TestHeuristicDedup:
    def test_reply_matches_original(self, store: JsonStore):
        original = _make_sub(store, "broker@acme.com", "New: Acme GL Policy")
        result = _heuristic_dedup("broker@acme.com", "Re: New: Acme GL Policy", [original])
        assert result["decision"] == "follow_up"
        assert result["matched_submission_id"] == original.id

    def test_forward_matches_original(self, store: JsonStore):
        original = _make_sub(store, "broker@acme.com", "Acme GL Submission")
        result = _heuristic_dedup("broker@acme.com", "Fwd: Acme GL Submission", [original])
        assert result["decision"] == "follow_up"

    def test_exact_subject_matches(self, store: JsonStore):
        original = _make_sub(store, "broker@acme.com", "Acme GL Policy")
        result = _heuristic_dedup("broker@acme.com", "Acme GL Policy", [original])
        assert result["decision"] == "follow_up"

    def test_different_subject_is_new(self, store: JsonStore):
        original = _make_sub(store, "broker@acme.com", "Acme GL Policy")
        result = _heuristic_dedup("broker@acme.com", "Bright Pixel Design Studio", [original])
        assert result["decision"] == "new"

    def test_empty_list_is_new(self):
        result = _heuristic_dedup("broker@acme.com", "New submission", [])
        assert result["decision"] == "new"

    def test_fw_prefix_matches(self, store: JsonStore):
        original = _make_sub(store, "broker@acme.com", "Acme Policy")
        result = _heuristic_dedup("broker@acme.com", "Fw: Acme Policy", [original])
        assert result["decision"] == "follow_up"

    def test_case_insensitive(self, store: JsonStore):
        original = _make_sub(store, "broker@acme.com", "ACME GL POLICY")
        result = _heuristic_dedup("broker@acme.com", "acme gl policy", [original])
        assert result["decision"] == "follow_up"
