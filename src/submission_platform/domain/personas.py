"""Personas — configurable broker service identities with tone, personality, and signature."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, Field

from submission_platform.infra.json_store import JsonStore
from submission_platform.infra.logging import get_logger

log = get_logger(__name__)

ENTITY_TYPE = "personas"


class Persona(BaseModel):
    id: str = Field(default_factory=lambda: f"persona-{uuid.uuid4().hex[:8]}")
    name: str
    title: str = ""
    photo: str = ""
    email_name: str = ""
    email_address: str = ""
    tone: str = "professional"
    personality: str = ""
    signature: str = ""
    greeting_style: str = "Hi,"
    closing_style: str = ""
    active: bool = True


# Default personas (seeded on first use)
_DEFAULTS = [
    Persona(
        id="persona-sarah",
        name="Sarah Chen",
        title="Processing Specialist",
        email_name="Sarah Chen - Apex Insurance",
        email_address="sarah@apex-demo.com",
        tone="friendly",
        personality="Warm and approachable. Uses first names. Explains things clearly without jargon. Always ends with an encouraging note.",
        signature="Best regards,\nSarah Chen\nProcessing Specialist\nApex Insurance Group\n(469) 555-0100",
        greeting_style="Hi {broker_first_name},",
        closing_style="Let me know if you have any questions - happy to help.",
    ),
    Persona(
        id="persona-marcus",
        name="Marcus Johnson",
        title="Senior Analyst",
        email_name="Marcus Johnson - Apex Insurance",
        email_address="marcus@apex-demo.com",
        tone="professional",
        personality="Direct and efficient. Gets to the point quickly. Focuses on facts and timelines. Minimal small talk.",
        signature="Regards,\nMarcus Johnson\nSenior Analyst\nApex Insurance Group",
        greeting_style="Dear {broker_name},",
        closing_style="Please provide the above at your earliest convenience.",
    ),
    Persona(
        id="persona-diana",
        name="Diana Reyes",
        title="Account Manager",
        email_name="Diana Reyes - Apex Insurance",
        email_address="diana@apex-demo.com",
        tone="detailed",
        personality="Thorough and meticulous. Provides detailed explanations of what is needed and why. Patient and supportive, especially with first-time submitters.",
        signature="Kind regards,\nDiana Reyes\nAccount Manager\nApex Insurance Group\n(469) 555-0155",
        greeting_style="Hello {broker_name},",
        closing_style="I have outlined everything we need above. Please do not hesitate to reach out if anything is unclear.",
    ),
]


def _seed_defaults(store: JsonStore) -> None:
    """Seed default personas if none exist."""
    existing = store.list_all(ENTITY_TYPE, Persona)
    if not existing:
        for p in _DEFAULTS:
            store.save(ENTITY_TYPE, p.id, p)
        log.info("personas_seeded", count=len(_DEFAULTS))


def list_personas(store: JsonStore) -> list[Persona]:
    _seed_defaults(store)
    return [p for p in store.list_all(ENTITY_TYPE, Persona) if p.active]


def get_persona(persona_id: str, store: JsonStore) -> Persona | None:
    _seed_defaults(store)
    return store.load(ENTITY_TYPE, persona_id, Persona)


def create_persona(data: dict, store: JsonStore) -> Persona:
    p = Persona(**data)
    store.save(ENTITY_TYPE, p.id, p)
    log.info("persona_created", id=p.id, name=p.name)
    return p


def update_persona(persona_id: str, data: dict, store: JsonStore) -> Persona | None:
    p = store.load(ENTITY_TYPE, persona_id, Persona)
    if p is None:
        return None
    for k, v in data.items():
        if hasattr(p, k):
            setattr(p, k, v)
    store.save(ENTITY_TYPE, p.id, p)
    return p


def delete_persona(persona_id: str, store: JsonStore) -> bool:
    p = store.load(ENTITY_TYPE, persona_id, Persona)
    if p is None:
        return False
    p.active = False
    store.save(ENTITY_TYPE, p.id, p)
    return True


def get_persona_for_submission(submission, store: JsonStore) -> Persona | None:
    """Get the persona assigned to a submission, or the first default."""
    _seed_defaults(store)
    if submission.persona_id:
        p = store.load(ENTITY_TYPE, submission.persona_id, Persona)
        if p and p.active:
            return p
    # Fallback: first active persona
    all_p = list_personas(store)
    return all_p[0] if all_p else None
