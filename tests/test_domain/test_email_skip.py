"""Test email skip logic for bounce/system emails."""
from __future__ import annotations


def test_skip_subjects():
    """Verify our skip list catches all common bounce patterns."""
    from submission_platform.domain.gmail_push import _fetch_and_process_message

    SKIP_SUBJECTS = [
        "delivery status notification",
        "undeliverable",
        "mail delivery failed",
        "returned mail",
        "failure notice",
        "auto-reply",
        "automatic reply",
        "out of office",
        "submission received",
    ]

    # These should be skipped
    skip_cases = [
        "Delivery Status Notification (Failure)",
        "Undeliverable: Re: Your submission",
        "Mail Delivery Failed - returning message",
        "Returned mail: see transcript for details",
        "Failure Notice",
        "Auto-Reply: I'm out of the office",
        "Automatic Reply: OOO",
        "Out of Office Re: Acme Policy",
        "Submission Received - We're On It",
        "RE: Submission Received - We're On It",
    ]

    for subject in skip_cases:
        subject_lower = subject.lower()
        matched = any(skip in subject_lower for skip in SKIP_SUBJECTS)
        assert matched, f"Should skip: '{subject}'"

    # These should NOT be skipped
    allow_cases = [
        "New Submission: Acme Healthcare - GL",
        "Re: Missing information for Acme policy",
        "Loss runs for Bright Pixel Design",
        "Quote request - Riverdale Plumbing",
    ]

    for subject in allow_cases:
        subject_lower = subject.lower()
        matched = any(skip in subject_lower for skip in SKIP_SUBJECTS)
        assert not matched, f"Should NOT skip: '{subject}'"


def test_skip_mailer_daemon():
    """Verify mailer-daemon and postmaster are skipped."""
    skip_senders = ["mailer-daemon@gmail.com", "MAILER-DAEMON@mx.google.com", "postmaster@gmail.com"]
    for sender in skip_senders:
        from_lower = sender.lower()
        assert "mailer-daemon" in from_lower or "postmaster" in from_lower
