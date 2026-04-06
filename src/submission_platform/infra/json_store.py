from __future__ import annotations

import fcntl
import json
import os
import tempfile
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel

from submission_platform.config import get_settings

T = TypeVar("T", bound=BaseModel)


class JsonStore:
    """JSON file persistence: one file per entity with atomic writes and file locking."""

    def __init__(self, base_dir: Path | None = None):
        self._base_dir = base_dir or get_settings().data_dir

    def _entity_dir(self, entity_type: str) -> Path:
        d = self._base_dir / entity_type
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _entity_path(self, entity_type: str, entity_id: str) -> Path:
        return self._entity_dir(entity_type) / f"{entity_id}.json"

    def save(self, entity_type: str, entity_id: str | None, data: BaseModel) -> str:
        """Atomically write an entity to its JSON file. If entity_id is None, uses data.id."""
        if entity_id is None:
            entity_id = getattr(data, "id", None)
            if entity_id is None:
                import uuid
                entity_id = str(uuid.uuid4())
        path = self._entity_path(entity_type, entity_id)
        content = data.model_dump_json(indent=2)

        # Atomic write: write to temp file then rename
        dir_path = path.parent
        fd, tmp_path = tempfile.mkstemp(dir=str(dir_path), suffix=".tmp")
        try:
            with os.fdopen(fd, "w") as f:
                fcntl.flock(f, fcntl.LOCK_EX)
                f.write(content)
                f.flush()
                os.fsync(f.fileno())
                fcntl.flock(f, fcntl.LOCK_UN)
            os.replace(tmp_path, str(path))
        except Exception:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
            raise
        return entity_id

    def load(self, entity_type: str, entity_id: str, model_class: type[T]) -> T | None:
        """Load an entity by type and ID. Returns None if not found."""
        path = self._entity_path(entity_type, entity_id)
        if not path.exists():
            return None
        with open(path) as f:
            fcntl.flock(f, fcntl.LOCK_SH)
            raw = json.load(f)
            fcntl.flock(f, fcntl.LOCK_UN)
        return model_class.model_validate(raw)

    def list_all(self, entity_type: str, model_class: type[T]) -> list[T]:
        """List all entities of a given type."""
        d = self._entity_dir(entity_type)
        results = []
        for path in sorted(d.glob("*.json")):
            with open(path) as f:
                raw = json.load(f)
            results.append(model_class.model_validate(raw))
        return results

    def delete(self, entity_type: str, entity_id: str) -> bool:
        """Delete an entity. Returns True if it existed."""
        path = self._entity_path(entity_type, entity_id)
        if path.exists():
            path.unlink()
            return True
        return False

    def exists(self, entity_type: str, entity_id: str) -> bool:
        return self._entity_path(entity_type, entity_id).exists()


_default_store: JsonStore | None = None


def get_default_store() -> JsonStore:
    global _default_store
    if _default_store is None:
        _default_store = JsonStore()
    return _default_store
