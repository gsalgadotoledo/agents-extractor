from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from submission_platform.infra.json_store import JsonStore


@pytest.fixture
def tmp_store(tmp_path: Path) -> JsonStore:
    """Provide a JsonStore backed by a temporary directory."""
    return JsonStore(base_dir=tmp_path)
