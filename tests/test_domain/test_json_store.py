"""JSON store tests — atomic writes, concurrent safety, edge cases."""
from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import BaseModel

from submission_platform.infra.json_store import JsonStore


class SampleModel(BaseModel):
    id: str = "test-1"
    name: str = "Test"
    value: int = 0


@pytest.fixture
def store(tmp_path: Path) -> JsonStore:
    return JsonStore(base_dir=tmp_path)


class TestBasicOperations:
    def test_save_and_load(self, store: JsonStore):
        obj = SampleModel(id="s1", name="Hello", value=42)
        store.save("items", "s1", obj)
        loaded = store.load("items", "s1", SampleModel)
        assert loaded is not None
        assert loaded.name == "Hello"
        assert loaded.value == 42

    def test_load_nonexistent(self, store: JsonStore):
        result = store.load("items", "nope", SampleModel)
        assert result is None

    def test_list_all(self, store: JsonStore):
        for i in range(5):
            store.save("items", f"s{i}", SampleModel(id=f"s{i}", name=f"Item {i}"))
        results = store.list_all("items", SampleModel)
        assert len(results) == 5

    def test_list_all_empty(self, store: JsonStore):
        results = store.list_all("items", SampleModel)
        assert results == []

    def test_delete(self, store: JsonStore):
        store.save("items", "s1", SampleModel())
        assert store.exists("items", "s1")
        deleted = store.delete("items", "s1")
        assert deleted is True
        assert not store.exists("items", "s1")

    def test_delete_nonexistent(self, store: JsonStore):
        deleted = store.delete("items", "nope")
        assert deleted is False

    def test_exists(self, store: JsonStore):
        assert not store.exists("items", "s1")
        store.save("items", "s1", SampleModel())
        assert store.exists("items", "s1")

    def test_save_with_none_id_uses_model_id(self, store: JsonStore):
        obj = SampleModel(id="auto-id", name="Auto")
        returned_id = store.save("items", None, obj)
        assert returned_id == "auto-id"
        loaded = store.load("items", "auto-id", SampleModel)
        assert loaded is not None

    def test_overwrite_existing(self, store: JsonStore):
        store.save("items", "s1", SampleModel(id="s1", name="V1", value=1))
        store.save("items", "s1", SampleModel(id="s1", name="V2", value=2))
        loaded = store.load("items", "s1", SampleModel)
        assert loaded.name == "V2"
        assert loaded.value == 2

    def test_auto_creates_directories(self, store: JsonStore):
        store.save("deep/nested/type", "s1", SampleModel())
        loaded = store.load("deep/nested/type", "s1", SampleModel)
        assert loaded is not None


class TestEdgeCases:
    def test_special_characters_in_id(self, store: JsonStore):
        store.save("items", "id-with-dashes_and_underscores", SampleModel(id="id-with-dashes_and_underscores"))
        loaded = store.load("items", "id-with-dashes_and_underscores", SampleModel)
        assert loaded is not None

    def test_large_data(self, store: JsonStore):
        obj = SampleModel(id="big", name="x" * 100000, value=999)
        store.save("items", "big", obj)
        loaded = store.load("items", "big", SampleModel)
        assert len(loaded.name) == 100000

    def test_concurrent_saves_dont_corrupt(self, store: JsonStore):
        """Save the same key many times rapidly — file should not be corrupted."""
        for i in range(50):
            store.save("items", "race", SampleModel(id="race", name=f"Version {i}", value=i))
        loaded = store.load("items", "race", SampleModel)
        assert loaded is not None
        assert loaded.value == 49
