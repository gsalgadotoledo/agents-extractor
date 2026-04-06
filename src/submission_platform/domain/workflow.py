from __future__ import annotations

from submission_platform.domain.models import SubmissionStatus

VALID_TRANSITIONS: dict[SubmissionStatus, set[SubmissionStatus]] = {
    SubmissionStatus.RECEIVED: {SubmissionStatus.ACK_SENT, SubmissionStatus.FAILED},
    SubmissionStatus.ACK_SENT: {SubmissionStatus.PARSING, SubmissionStatus.FAILED},
    SubmissionStatus.PARSING: {SubmissionStatus.EXTRACTING, SubmissionStatus.FAILED},
    SubmissionStatus.EXTRACTING: {
        SubmissionStatus.EXTRACTED,
        SubmissionStatus.FAILED,
        SubmissionStatus.RECEIVED,  # retry
    },
    SubmissionStatus.EXTRACTED: {SubmissionStatus.VALIDATED, SubmissionStatus.FAILED},
    SubmissionStatus.VALIDATED: {
        SubmissionStatus.NEEDS_REVIEW,
        SubmissionStatus.AUTO_POLICY_READY,
        SubmissionStatus.FAILED,
    },
    SubmissionStatus.NEEDS_REVIEW: {
        SubmissionStatus.POLICY_CREATED,
        SubmissionStatus.FAILED,
        SubmissionStatus.COMPLETED,
    },
    SubmissionStatus.AUTO_POLICY_READY: {SubmissionStatus.POLICY_CREATED, SubmissionStatus.FAILED},
    SubmissionStatus.POLICY_CREATED: {
        SubmissionStatus.OUTBOUND_EMAIL_PENDING,
        SubmissionStatus.FAILED,
    },
    SubmissionStatus.OUTBOUND_EMAIL_PENDING: {
        SubmissionStatus.COMPLETED,
        SubmissionStatus.FAILED,
    },
    SubmissionStatus.COMPLETED: set(),
    SubmissionStatus.FAILED: {SubmissionStatus.RECEIVED},  # allow retry from failed
}


class InvalidTransitionError(Exception):
    pass


def validate_transition(
    current: SubmissionStatus, target: SubmissionStatus
) -> None:
    allowed = VALID_TRANSITIONS.get(current, set())
    if target not in allowed:
        raise InvalidTransitionError(
            f"Cannot transition from {current.value} to {target.value}. "
            f"Allowed: {[s.value for s in allowed]}"
        )
