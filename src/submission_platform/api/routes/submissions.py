from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from submission_platform.api.dependencies import get_app_settings, get_store
from submission_platform.config import Settings
from submission_platform.domain import assignment, extraction, missing_fields, slack_service, submissions
from submission_platform.domain.models import (
    ExtractionResult,
    Submission,
    SubmissionStatus,
)
from submission_platform.infra.json_store import JsonStore

router = APIRouter(prefix="/submissions", tags=["submissions"])


class CreateSubmissionRequest(BaseModel):
    broker_email: str
    subject: str
    body_text: str
    broker_name: str | None = None
    message_id: str = ""


@router.post("/", response_model=Submission)
async def create_submission_endpoint(
    payload: CreateSubmissionRequest,
    store: JsonStore = Depends(get_store),
):
    return await submissions.create_submission(
        broker_email=payload.broker_email,
        subject=payload.subject,
        body_text=payload.body_text,
        broker_name=payload.broker_name,
        message_id=payload.message_id,
        store=store,
    )


@router.get("/", response_model=list[Submission])
async def list_submissions_endpoint(
    status: SubmissionStatus | None = None,
    broker_email: str | None = None,
    store: JsonStore = Depends(get_store),
):
    return await submissions.list_submissions(
        store=store, status=status, broker_email=broker_email
    )


@router.get("/{submission_id}", response_model=Submission)
async def get_submission_endpoint(
    submission_id: str,
    store: JsonStore = Depends(get_store),
):
    sub = await submissions.get_submission(submission_id, store=store)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    return sub


class TransitionRequest(BaseModel):
    new_status: SubmissionStatus


@router.post("/{submission_id}/transition", response_model=Submission)
async def transition_submission_endpoint(
    submission_id: str,
    payload: TransitionRequest,
    store: JsonStore = Depends(get_store),
):
    try:
        return await submissions.transition_submission(
            submission_id, payload.new_status, store=store
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{submission_id}/extract", response_model=ExtractionResult)
async def extract_submission_endpoint(
    submission_id: str,
    store: JsonStore = Depends(get_store),
    settings: Settings = Depends(get_app_settings),
):
    try:
        return await extraction.extract_submission_data(
            submission_id, store=store, settings=settings
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class PatchExtractedDataRequest(BaseModel):
    path: str
    value: str | int | float | bool | None


@router.patch("/{submission_id}/extracted-data")
async def patch_extracted_data(
    submission_id: str,
    payload: PatchExtractedDataRequest,
    store: JsonStore = Depends(get_store),
):
    """Update a single field in the submission's extracted_data."""
    sub = await submissions.get_submission(submission_id, store=store)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if sub.extracted_data is None:
        raise HTTPException(status_code=400, detail="No extracted data to patch")

    parts = payload.path.split(".")
    target = sub.extracted_data
    for part in parts[:-1]:
        if part.isdigit():
            if isinstance(target, list) and int(part) < len(target):
                target = target[int(part)]
            else:
                raise HTTPException(status_code=400, detail=f"Invalid path: {payload.path}")
        elif isinstance(target, dict):
            if part not in target:
                target[part] = {}
            target = target[part]
        else:
            raise HTTPException(status_code=400, detail=f"Invalid path: {payload.path}")

    last_key = parts[-1]
    if last_key.isdigit() and isinstance(target, list):
        target[int(last_key)] = payload.value
    elif isinstance(target, dict):
        target[last_key] = payload.value
    else:
        raise HTTPException(status_code=400, detail=f"Cannot set {payload.path}")

    if isinstance(sub.extracted_data.get("missing_fields"), list):
        sub.extracted_data["missing_fields"] = [
            f for f in sub.extracted_data["missing_fields"]
            if payload.path.split(".")[-1] not in f.lower().replace(" ", "_")
        ]

    store.save("submissions", sub.id, sub)
    return {"ok": True, "path": payload.path, "value": payload.value}


# --- Assignment & Approval ---

@router.get("/meta/users")
async def list_users():
    """List all representatives and approvers."""
    return {
        "representatives": assignment.REPRESENTATIVES,
        "approvers": assignment.APPROVERS,
        "all": list(assignment.ALL_USERS.values()),
    }


class AssignRequest(BaseModel):
    rep_id: str


@router.post("/{submission_id}/assign")
async def assign_submission(
    submission_id: str,
    payload: AssignRequest,
    store: JsonStore = Depends(get_store),
):
    result = assignment.reassign(submission_id, payload.rep_id, store)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


class ApproveRequest(BaseModel):
    approver_id: str


@router.post("/{submission_id}/approve")
async def approve_submission(
    submission_id: str,
    payload: ApproveRequest,
    store: JsonStore = Depends(get_store),
):
    result = assignment.approve(submission_id, payload.approver_id, store)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


class AssignPersonaRequest(BaseModel):
    persona_id: str


@router.post("/{submission_id}/assign-persona")
async def assign_persona_endpoint(
    submission_id: str,
    payload: AssignPersonaRequest,
    store: JsonStore = Depends(get_store),
):
    sub = await submissions.get_submission(submission_id, store=store)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    sub.persona_id = payload.persona_id if payload.persona_id != "default" else None
    from datetime import datetime, timezone
    sub.updated_at = datetime.now(timezone.utc)
    store.save("submissions", sub.id, sub)
    return {"ok": True, "persona_id": sub.persona_id}


@router.get("/{submission_id}/missing-fields")
async def get_missing_fields(
    submission_id: str,
    store: JsonStore = Depends(get_store),
):
    """Dynamically compute missing fields from extracted data."""
    sub = await submissions.get_submission(submission_id, store=store)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    return missing_fields.compute_missing_fields(sub.extracted_data)


@router.delete("/{submission_id}")
async def delete_submission(
    submission_id: str,
    store: JsonStore = Depends(get_store),
):
    """Soft-delete a submission. Data stays in storage but won't appear in lists."""
    from datetime import datetime, timezone
    sub = await submissions.get_submission(submission_id, store=store)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    sub.deleted = True
    sub.deleted_at = datetime.now(timezone.utc)
    sub.chat_history.append({"role": "system", "content": "Submission archived"})
    store.save("submissions", sub.id, sub)
    return {"ok": True, "id": submission_id}


@router.post("/{submission_id}/notify-slack")
async def notify_slack(
    submission_id: str,
    store: JsonStore = Depends(get_store),
    settings: Settings = Depends(get_app_settings),
):
    """Manually trigger a Slack notification for a submission."""
    sub = await submissions.get_submission(submission_id, store=store)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    ok = await slack_service.notify_new_submission(sub, settings=settings)
    return {"ok": ok}
