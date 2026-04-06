from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, Response

from submission_platform.api.dependencies import get_store
from submission_platform.domain import submissions
from submission_platform.infra.json_store import JsonStore

router = APIRouter(prefix="/submissions", tags=["attachments"])


@router.get("/{submission_id}/attachments/{filename}")
async def download_attachment(
    submission_id: str,
    filename: str,
    store: JsonStore = Depends(get_store),
):
    """Download or view an attachment file."""
    sub = await submissions.get_submission(submission_id, store=store)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    att = next((a for a in sub.attachments if a.filename == filename), None)
    if att is None:
        raise HTTPException(status_code=404, detail=f"Attachment '{filename}' not found")

    path = Path(att.storage_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Attachment file missing from disk")

    content = path.read_bytes()
    is_pdf = att.content_type == "application/pdf" or filename.lower().endswith(".pdf")

    return Response(
        content=content,
        media_type=att.content_type if is_pdf else "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"' if is_pdf else f'attachment; filename="{filename}"',
        },
    )


@router.get("/{submission_id}/attachments/{filename}/text")
async def get_attachment_text(
    submission_id: str,
    filename: str,
    store: JsonStore = Depends(get_store),
):
    """Get extracted text from a PDF attachment."""
    sub = await submissions.get_submission(submission_id, store=store)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    att = next((a for a in sub.attachments if a.filename == filename), None)
    if att is None:
        raise HTTPException(status_code=404, detail=f"Attachment '{filename}' not found")

    path = Path(att.storage_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Attachment file missing from disk")

    if att.content_type == "application/pdf" or filename.lower().endswith(".pdf"):
        from submission_platform.domain.extraction import _extract_pdf_text
        text = _extract_pdf_text(str(path))
    else:
        try:
            text = path.read_text(errors="replace")
        except Exception:
            text = "(Cannot extract text from this file type)"

    return {"filename": filename, "text": text, "chars": len(text)}
