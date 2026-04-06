"""Documents endpoint — generated output files (policies, quotes, binders, etc.)."""
from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from fpdf import FPDF
from pydantic import BaseModel

from submission_platform.api.dependencies import get_app_settings, get_store
from submission_platform.config import Settings
from submission_platform.domain import submissions
from submission_platform.infra.json_store import JsonStore

router = APIRouter(prefix="/submissions", tags=["documents"])

DOCUMENT_TYPES = [
    "policy",
    "quote",
    "binder",
    "endorsement",
    "certificate",
    "invoice",
    "loss_runs",
    "application",
    "correspondence",
    "other",
]


class DocumentMeta(BaseModel):
    filename: str
    doc_type: str
    size_bytes: int
    created_at: str
    notes: str = ""


class DocumentListResponse(BaseModel):
    documents: list[DocumentMeta]
    count: int


def _docs_dir(store: JsonStore, submission_id: str) -> Path:
    d = store._base_dir / "documents" / submission_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _meta_path(store: JsonStore, submission_id: str) -> Path:
    return _docs_dir(store, submission_id) / "_meta.json"


def _load_meta(store: JsonStore, submission_id: str) -> list[dict]:
    import json
    p = _meta_path(store, submission_id)
    if p.exists():
        return json.loads(p.read_text())
    return []


def _save_meta(store: JsonStore, submission_id: str, meta: list[dict]) -> None:
    import json
    p = _meta_path(store, submission_id)
    p.write_text(json.dumps(meta, indent=2))


@router.get("/{submission_id}/documents", response_model=DocumentListResponse)
async def list_documents(
    submission_id: str,
    store: JsonStore = Depends(get_store),
):
    sub = await submissions.get_submission(submission_id, store=store)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    meta = _load_meta(store, submission_id)
    docs = [DocumentMeta(**m) for m in meta]
    return DocumentListResponse(documents=docs, count=len(docs))


@router.post("/{submission_id}/documents")
async def upload_document(
    submission_id: str,
    doc_type: str = "other",
    notes: str = "",
    file: UploadFile = File(...),
    store: JsonStore = Depends(get_store),
):
    sub = await submissions.get_submission(submission_id, store=store)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if doc_type not in DOCUMENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid doc_type. Valid: {DOCUMENT_TYPES}")

    docs_dir = _docs_dir(store, submission_id)
    dest = docs_dir / file.filename
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    meta = _load_meta(store, submission_id)
    meta.append({
        "filename": file.filename,
        "doc_type": doc_type,
        "size_bytes": dest.stat().st_size,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "notes": notes,
    })
    _save_meta(store, submission_id, meta)

    return {"ok": True, "filename": file.filename, "doc_type": doc_type}


@router.get("/{submission_id}/documents/{filename}")
async def download_document(
    submission_id: str,
    filename: str,
    store: JsonStore = Depends(get_store),
):
    sub = await submissions.get_submission(submission_id, store=store)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    docs_dir = _docs_dir(store, submission_id)
    path = docs_dir / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Document not found")

    content = path.read_bytes()
    is_pdf = filename.lower().endswith(".pdf")
    return Response(
        content=content,
        media_type="application/pdf" if is_pdf else "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{filename}"' if is_pdf else f'attachment; filename="{filename}"'},
    )


@router.delete("/{submission_id}/documents/{filename}")
async def delete_document(
    submission_id: str,
    filename: str,
    store: JsonStore = Depends(get_store),
):
    docs_dir = _docs_dir(store, submission_id)
    path = docs_dir / filename
    if path.exists():
        path.unlink()
    meta = _load_meta(store, submission_id)
    meta = [m for m in meta if m["filename"] != filename]
    _save_meta(store, submission_id, meta)
    return {"ok": True}


class GenerateDocRequest(BaseModel):
    doc_type: str  # quote, policy, binder, certificate
    notes: str = ""


GENERATABLE_TYPES = {
    "quote": "Quote Proposal",
    "policy": "Policy Declaration",
    "binder": "Binder of Insurance",
    "certificate": "Certificate of Insurance",
}


@router.post("/{submission_id}/documents/generate")
async def generate_document(
    submission_id: str,
    payload: GenerateDocRequest,
    store: JsonStore = Depends(get_store),
    settings: Settings = Depends(get_app_settings),
):
    """Generate a PDF document from extracted submission data."""
    sub = await submissions.get_submission(submission_id, store=store)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    if sub.extracted_data is None:
        raise HTTPException(status_code=400, detail="No extracted data — run extraction first")
    if payload.doc_type not in GENERATABLE_TYPES:
        raise HTTPException(status_code=400, detail=f"Cannot generate '{payload.doc_type}'. Options: {list(GENERATABLE_TYPES.keys())}")

    data = sub.extracted_data
    overview = data.get("overview", {})
    broker = data.get("broker", {})
    coverage = data.get("coverage", {})
    loss_runs = data.get("loss_runs", {})
    facilities = data.get("facilities", [])
    prior = data.get("prior_insurance", {})
    doc_title = GENERATABLE_TYPES[payload.doc_type]

    insured_name = overview.get("insured_name", "Unknown Insured")
    safe_name = "".join(c if c.isalnum() or c in " _-" else "" for c in insured_name).strip().replace(" ", "_")
    filename = f"{payload.doc_type}_{safe_name}_{datetime.now().strftime('%Y%m%d')}.pdf"

    # Build PDF
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Header
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, doc_title.upper(), new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, f"Generated: {datetime.now().strftime('%B %d, %Y')}", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(0, 6, f"Reference: {submission_id[:8]}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(8)

    # Insured section
    _pdf_section(pdf, "Named Insured")
    _pdf_field(pdf, "Insured Name", overview.get("insured_name", ""))
    if overview.get("dba"):
        _pdf_field(pdf, "DBA", overview["dba"])
    _pdf_field(pdf, "Business Type", overview.get("business_type", ""))
    _pdf_field(pdf, "FEIN", overview.get("fein", ""))
    _pdf_field(pdf, "Employees", str(overview.get("number_of_employees", "")))
    _pdf_field(pdf, "Annual Revenue", overview.get("annual_revenue", ""))
    pdf.ln(4)

    # Facilities
    if facilities:
        _pdf_section(pdf, f"Locations ({len(facilities)})")
        for i, fac in enumerate(facilities):
            addr = ", ".join(filter(None, [fac.get("address"), fac.get("city"), fac.get("state"), fac.get("zip")]))
            _pdf_field(pdf, f"Location {i + 1}", addr or "N/A")
        pdf.ln(4)

    # Coverage
    _pdf_section(pdf, "Coverage")
    _pdf_field(pdf, "Policy Type", coverage.get("policy_type", ""))
    _pdf_field(pdf, "Effective Date", coverage.get("effective_date", ""))
    _pdf_field(pdf, "Expiration Date", coverage.get("expiration_date", ""))
    _pdf_field(pdf, "Each Occurrence Limit", coverage.get("each_occurrence_limit", ""))
    _pdf_field(pdf, "General Aggregate", coverage.get("general_aggregate", ""))
    if coverage.get("products_completed_ops"):
        _pdf_field(pdf, "Products/Completed Ops", coverage["products_completed_ops"])
    pdf.ln(4)

    # Loss Runs Summary
    if loss_runs.get("present"):
        _pdf_section(pdf, f"Loss Run Summary ({loss_runs.get('years_covered', 0)} years)")
        summary = loss_runs.get("summary", {})
        _pdf_field(pdf, "Total Claims", str(summary.get("total_claims", 0)))
        _pdf_field(pdf, "Total Incurred", summary.get("total_incurred", "$0"))
        _pdf_field(pdf, "Total Paid", summary.get("total_paid", "$0"))
        _pdf_field(pdf, "Loss Ratio", summary.get("loss_ratio", "N/A"))
        pdf.ln(4)

    # Prior Insurance
    if prior.get("carrier"):
        _pdf_section(pdf, "Prior Insurance")
        _pdf_field(pdf, "Carrier", prior.get("carrier", ""))
        _pdf_field(pdf, "Policy Number", prior.get("policy_number", ""))
        _pdf_field(pdf, "Premium", prior.get("premium", ""))
        pdf.ln(4)

    # Broker
    _pdf_section(pdf, "Producing Broker")
    _pdf_field(pdf, "Name", broker.get("name", ""))
    _pdf_field(pdf, "Company", broker.get("company", ""))
    _pdf_field(pdf, "Email", broker.get("email", ""))
    _pdf_field(pdf, "Phone", broker.get("phone", ""))

    if payload.notes:
        pdf.ln(6)
        _pdf_section(pdf, "Notes")
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 5, payload.notes, new_x="LMARGIN", new_y="NEXT")

    # Footer
    pdf.ln(10)
    pdf.set_font("Helvetica", "I", 8)
    pdf.cell(0, 5, "This document was automatically generated from submission data.", new_x="LMARGIN", new_y="NEXT")

    # Save
    docs_dir = _docs_dir(store, submission_id)
    dest = docs_dir / filename
    pdf.output(str(dest))

    meta = _load_meta(store, submission_id)
    meta.append({
        "filename": filename,
        "doc_type": payload.doc_type,
        "size_bytes": dest.stat().st_size,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "notes": payload.notes or f"Auto-generated {doc_title}",
    })
    _save_meta(store, submission_id, meta)

    return {"ok": True, "filename": filename, "doc_type": payload.doc_type}


def _pdf_section(pdf: FPDF, title: str) -> None:
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(200, 200, 200)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(2)


def _pdf_field(pdf: FPDF, label: str, value: str) -> None:
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(55, 6, f"{label}:")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(0, 6, value or "N/A", new_x="LMARGIN", new_y="NEXT")
