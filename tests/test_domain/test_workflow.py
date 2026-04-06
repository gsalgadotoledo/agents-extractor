"""Workflow transition tests — valid paths, invalid transitions, edge cases."""
from __future__ import annotations

import pytest

from submission_platform.domain.models import SubmissionStatus
from submission_platform.domain.workflow import InvalidTransitionError, VALID_TRANSITIONS, validate_transition


class TestValidTransitions:
    """Test the full happy path through all pipeline states."""

    def test_received_to_ack_sent(self):
        validate_transition(SubmissionStatus.RECEIVED, SubmissionStatus.ACK_SENT)

    def test_ack_sent_to_parsing(self):
        validate_transition(SubmissionStatus.ACK_SENT, SubmissionStatus.PARSING)

    def test_parsing_to_extracting(self):
        validate_transition(SubmissionStatus.PARSING, SubmissionStatus.EXTRACTING)

    def test_extracting_to_extracted(self):
        validate_transition(SubmissionStatus.EXTRACTING, SubmissionStatus.EXTRACTED)

    def test_extracted_to_validated(self):
        validate_transition(SubmissionStatus.EXTRACTED, SubmissionStatus.VALIDATED)

    def test_validated_to_needs_review(self):
        validate_transition(SubmissionStatus.VALIDATED, SubmissionStatus.NEEDS_REVIEW)

    def test_validated_to_auto_policy(self):
        validate_transition(SubmissionStatus.VALIDATED, SubmissionStatus.AUTO_POLICY_READY)

    def test_auto_policy_to_created(self):
        validate_transition(SubmissionStatus.AUTO_POLICY_READY, SubmissionStatus.POLICY_CREATED)

    def test_policy_created_to_outbound(self):
        validate_transition(SubmissionStatus.POLICY_CREATED, SubmissionStatus.OUTBOUND_EMAIL_PENDING)

    def test_outbound_to_completed(self):
        validate_transition(SubmissionStatus.OUTBOUND_EMAIL_PENDING, SubmissionStatus.COMPLETED)

    def test_failed_can_retry(self):
        validate_transition(SubmissionStatus.FAILED, SubmissionStatus.RECEIVED)

    def test_extracting_can_retry(self):
        validate_transition(SubmissionStatus.EXTRACTING, SubmissionStatus.RECEIVED)


class TestInvalidTransitions:
    """Test that invalid transitions raise errors."""

    def test_received_cannot_jump_to_completed(self):
        with pytest.raises(InvalidTransitionError):
            validate_transition(SubmissionStatus.RECEIVED, SubmissionStatus.COMPLETED)

    def test_completed_is_terminal(self):
        with pytest.raises(InvalidTransitionError):
            validate_transition(SubmissionStatus.COMPLETED, SubmissionStatus.RECEIVED)

    def test_received_cannot_go_to_extracted(self):
        with pytest.raises(InvalidTransitionError):
            validate_transition(SubmissionStatus.RECEIVED, SubmissionStatus.EXTRACTED)

    def test_extracted_cannot_go_back_to_received(self):
        with pytest.raises(InvalidTransitionError):
            validate_transition(SubmissionStatus.EXTRACTED, SubmissionStatus.RECEIVED)

    def test_needs_review_cannot_go_to_extracting(self):
        with pytest.raises(InvalidTransitionError):
            validate_transition(SubmissionStatus.NEEDS_REVIEW, SubmissionStatus.EXTRACTING)

    def test_any_state_can_fail(self):
        """Every non-terminal state should be able to transition to FAILED."""
        for status in SubmissionStatus:
            if status in (SubmissionStatus.COMPLETED, SubmissionStatus.FAILED):
                continue
            allowed = VALID_TRANSITIONS.get(status, set())
            assert SubmissionStatus.FAILED in allowed, f"{status} cannot transition to FAILED"
