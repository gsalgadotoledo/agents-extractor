from __future__ import annotations

import pytest

from submission_platform.domain.models import Submission, SubmissionStatus
from submission_platform.domain.submissions import (
    create_submission,
    get_submission,
    list_submissions,
    transition_submission,
)
from submission_platform.domain.workflow import InvalidTransitionError
from submission_platform.infra.json_store import JsonStore


@pytest.mark.asyncio
async def test_create_submission(tmp_store: JsonStore):
    sub = await create_submission(
        broker_email="broker@test.com",
        subject="Test GL Policy",
        body_text="Please quote GL for Acme Corp.",
        store=tmp_store,
    )
    assert sub.id
    assert sub.broker_email == "broker@test.com"
    assert sub.status == SubmissionStatus.RECEIVED
    assert sub.subject == "Test GL Policy"


@pytest.mark.asyncio
async def test_get_submission(tmp_store: JsonStore):
    sub = await create_submission(
        broker_email="broker@test.com",
        subject="Test",
        body_text="Body",
        store=tmp_store,
    )
    loaded = await get_submission(sub.id, store=tmp_store)
    assert loaded is not None
    assert loaded.id == sub.id
    assert loaded.broker_email == sub.broker_email


@pytest.mark.asyncio
async def test_get_submission_not_found(tmp_store: JsonStore):
    result = await get_submission("nonexistent-id", store=tmp_store)
    assert result is None


@pytest.mark.asyncio
async def test_list_submissions(tmp_store: JsonStore):
    await create_submission(
        broker_email="a@test.com", subject="A", body_text="Body A", store=tmp_store
    )
    await create_submission(
        broker_email="b@test.com", subject="B", body_text="Body B", store=tmp_store
    )
    all_subs = await list_submissions(store=tmp_store)
    assert len(all_subs) == 2


@pytest.mark.asyncio
async def test_list_submissions_filter_by_status(tmp_store: JsonStore):
    sub = await create_submission(
        broker_email="a@test.com", subject="A", body_text="Body A", store=tmp_store
    )
    # Transition one to ack_sent
    await transition_submission(sub.id, SubmissionStatus.ACK_SENT, store=tmp_store)
    await create_submission(
        broker_email="b@test.com", subject="B", body_text="Body B", store=tmp_store
    )

    received = await list_submissions(store=tmp_store, status=SubmissionStatus.RECEIVED)
    assert len(received) == 1
    acked = await list_submissions(store=tmp_store, status=SubmissionStatus.ACK_SENT)
    assert len(acked) == 1


@pytest.mark.asyncio
async def test_transition_submission(tmp_store: JsonStore):
    sub = await create_submission(
        broker_email="broker@test.com",
        subject="Test",
        body_text="Body",
        store=tmp_store,
    )
    result = await transition_submission(sub.id, SubmissionStatus.ACK_SENT, store=tmp_store)
    assert result.status == SubmissionStatus.ACK_SENT


@pytest.mark.asyncio
async def test_invalid_transition(tmp_store: JsonStore):
    sub = await create_submission(
        broker_email="broker@test.com",
        subject="Test",
        body_text="Body",
        store=tmp_store,
    )
    with pytest.raises(InvalidTransitionError):
        await transition_submission(sub.id, SubmissionStatus.COMPLETED, store=tmp_store)


@pytest.mark.asyncio
async def test_duplicate_message_id(tmp_store: JsonStore):
    sub1 = await create_submission(
        broker_email="broker@test.com",
        subject="Test",
        body_text="Body",
        message_id="<unique@test.com>",
        store=tmp_store,
    )
    sub2 = await create_submission(
        broker_email="broker@test.com",
        subject="Test",
        body_text="Body",
        message_id="<unique@test.com>",
        store=tmp_store,
    )
    assert sub1.id == sub2.id  # Same submission returned
