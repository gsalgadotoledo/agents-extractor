"""Soft delete tests."""
from __future__ import annotations

from pathlib import Path

import pytest

from submission_platform.domain.models import Submission
from submission_platform.domain.submissions import create_submission, list_submissions
from submission_platform.infra.json_store import JsonStore


@pytest.fixture
def store(tmp_path: Path) -> JsonStore:
    return JsonStore(base_dir=tmp_path)


@pytest.mark.asyncio
async def test_deleted_submissions_hidden_from_list(store: JsonStore):
    sub1 = await create_submission(broker_email="a@t.com", subject="A", body_text="A", store=store)
    sub2 = await create_submission(broker_email="b@t.com", subject="B", body_text="B", store=store)

    # Soft delete sub1
    sub1.deleted = True
    store.save("submissions", sub1.id, sub1)

    results = await list_submissions(store=store)
    assert len(results) == 1
    assert results[0].id == sub2.id


@pytest.mark.asyncio
async def test_deleted_submission_still_loadable_by_id(store: JsonStore):
    sub = await create_submission(broker_email="a@t.com", subject="A", body_text="A", store=store)
    sub.deleted = True
    store.save("submissions", sub.id, sub)

    from submission_platform.domain.submissions import get_submission
    loaded = await get_submission(sub.id, store=store)
    assert loaded is not None
    assert loaded.deleted is True


@pytest.mark.asyncio
async def test_multiple_deletes(store: JsonStore):
    subs = []
    for i in range(5):
        s = await create_submission(broker_email=f"{i}@t.com", subject=f"S{i}", body_text="B", store=store)
        subs.append(s)

    # Delete 3 of 5
    for s in subs[:3]:
        s.deleted = True
        store.save("submissions", s.id, s)

    results = await list_submissions(store=store)
    assert len(results) == 2
