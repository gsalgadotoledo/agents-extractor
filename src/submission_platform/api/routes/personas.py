"""Personas API — CRUD for broker service personas."""
from __future__ import annotations

import base64
import json
import random
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from submission_platform.api.dependencies import get_app_settings, get_store
from submission_platform.config import Settings
from submission_platform.domain import personas
from submission_platform.domain.models import Submission
from submission_platform.infra.json_store import JsonStore
from submission_platform.infra.logging import get_logger

log = get_logger(__name__)

router = APIRouter(prefix="/personas", tags=["personas"])


class PersonaRequest(BaseModel):
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


@router.get("/")
async def list_personas_endpoint(store: JsonStore = Depends(get_store)):
    return {"personas": [p.model_dump() for p in personas.list_personas(store)]}


@router.get("/{persona_id}")
async def get_persona_endpoint(persona_id: str, store: JsonStore = Depends(get_store)):
    p = personas.get_persona(persona_id, store)
    if p is None:
        raise HTTPException(status_code=404, detail="Persona not found")
    return p.model_dump()


@router.post("/")
async def create_persona_endpoint(payload: PersonaRequest, store: JsonStore = Depends(get_store)):
    p = personas.create_persona(payload.model_dump(), store)
    return p.model_dump()


@router.put("/{persona_id}")
async def update_persona_endpoint(persona_id: str, payload: PersonaRequest, store: JsonStore = Depends(get_store)):
    p = personas.update_persona(persona_id, payload.model_dump(), store)
    if p is None:
        raise HTTPException(status_code=404, detail="Persona not found")
    return p.model_dump()


@router.delete("/{persona_id}")
async def delete_persona_endpoint(persona_id: str, store: JsonStore = Depends(get_store)):
    ok = personas.delete_persona(persona_id, store)
    if not ok:
        raise HTTPException(status_code=404, detail="Persona not found")
    return {"ok": True}


@router.post("/generate")
async def generate_persona_endpoint(
    store: JsonStore = Depends(get_store),
    settings: Settings = Depends(get_app_settings),
):
    """Generate a random persona using OpenAI — name, personality, tone, and avatar image."""
    if not settings.openai_api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY required to generate personas")

    import openai
    client = openai.OpenAI(api_key=settings.openai_api_key)

    # Step 1: Generate persona details with GPT
    tones = ["professional", "friendly", "concise", "detailed"]
    tone = random.choice(tones)
    email_address = settings.gmail_address or "underwriting@apex-demo.com"

    gen_prompt = f"""Generate a fictional insurance underwriting representative persona. Return ONLY valid JSON with these fields:
{{
  "name": "First Last",
  "title": "job title at insurance company",
  "tone": "{tone}",
  "personality": "2-3 sentences describing communication style and personality traits",
  "signature": "multi-line email signature with name, title, company Apex Insurance Group, and a phone number",
  "greeting_style": "how they start emails, e.g. Hi {{broker_first_name}},",
  "closing_style": "how they end emails before the signature",
  "avatar_prompt": "a short description for generating a professional headshot portrait of this person, include ethnicity and age range"
}}
Be creative with diverse names and backgrounds. The personality must match the tone "{tone}"."""

    try:
        chat_resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": gen_prompt}],
            temperature=1.0,
        )
        raw = chat_resp.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        persona_data = json.loads(raw)
    except Exception as e:
        log.error("persona_generation_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to generate persona: {e}")

    # Step 2: Generate avatar with DALL-E
    avatar_path = ""
    avatar_prompt = persona_data.pop("avatar_prompt", "")
    if avatar_prompt:
        try:
            img_resp = client.images.generate(
                model="dall-e-3",
                prompt=f"Professional corporate headshot portrait photo of {avatar_prompt}. Clean background, professional lighting, business attire, friendly expression. Photorealistic.",
                size="1024x1024",
                quality="standard",
                n=1,
                response_format="b64_json",
            )
            img_b64 = img_resp.data[0].b64_json
            if img_b64:
                avatars_dir = store._base_dir / "avatars"
                avatars_dir.mkdir(parents=True, exist_ok=True)
                import uuid
                avatar_filename = f"{uuid.uuid4().hex[:12]}.png"
                avatar_file = avatars_dir / avatar_filename
                avatar_file.write_bytes(base64.b64decode(img_b64))
                avatar_path = f"/avatars/{avatar_filename}"
                log.info("avatar_generated", path=avatar_path)
        except Exception as e:
            log.error("avatar_generation_failed", error=str(e))

    # Step 3: Create the persona
    name = persona_data.get("name", "Agent")
    p = personas.create_persona({
        "name": name,
        "title": persona_data.get("title", "Underwriting Specialist"),
        "photo": avatar_path,
        "email_name": f"{name} - Apex Insurance",
        "email_address": email_address,
        "tone": persona_data.get("tone", tone),
        "personality": persona_data.get("personality", ""),
        "signature": persona_data.get("signature", f"Best regards,\n{name}"),
        "greeting_style": persona_data.get("greeting_style", "Hi,"),
        "closing_style": persona_data.get("closing_style", ""),
    }, store)

    return p.model_dump()


@router.get("/avatars/{filename}")
async def get_avatar(filename: str, store: JsonStore = Depends(get_store)):
    """Serve avatar images."""
    path = store._base_dir / "avatars" / filename
    if not path.exists():
        raise HTTPException(status_code=404)
    return FileResponse(str(path), media_type="image/png")
