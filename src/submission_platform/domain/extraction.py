"""Agentic extraction — uses a LangGraph ReAct agent with tools to extract
structured data from insurance submission emails in multiple passes.

The agent can:
1. Read the email content
2. Extract each section independently
3. Validate the extraction and identify gaps
4. Re-read and fill missing fields

This multi-step approach gives higher accuracy than single-shot extraction.
"""
from __future__ import annotations

import json
import operator
from typing import Annotated, TypedDict

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode

from submission_platform.config import Settings
from submission_platform.domain.models import ExtractionResult, Submission, SubmissionStatus
from submission_platform.domain.schemas import ExtractedSubmission
from submission_platform.infra.json_store import JsonStore
from submission_platform.infra.logging import get_logger

log = get_logger(__name__)

AVAILABLE_MODELS = [
    "claude-sonnet-4-20250514",
    "claude-opus-4-20250514",
    "claude-haiku-4-20250514",
]

# ---------------------------------------------------------------------------
# Agent tools — each tool extracts a specific section
# ---------------------------------------------------------------------------

# These are created as closures per-extraction so they can access the email content


def _extract_pdf_text(file_path: str) -> str:
    """Extract text from a PDF file."""
    try:
        from pypdf import PdfReader
        reader = PdfReader(file_path)
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text.strip():
                pages.append(f"--- Page {i + 1} ---\n{text}")
        return "\n\n".join(pages) if pages else "(No text extracted from PDF)"
    except Exception as e:
        return f"(Error reading PDF: {e})"


def _extract_attachment_text(file_path: str, content_type: str) -> str:
    """Extract text from an attachment based on content type."""
    if content_type == "application/pdf" or file_path.lower().endswith(".pdf"):
        return _extract_pdf_text(file_path)
    if content_type.startswith("text/"):
        try:
            return open(file_path).read()
        except Exception as e:
            return f"(Error reading text file: {e})"
    return f"(Unsupported content type: {content_type})"


def _make_extraction_tools(
    email_subject: str,
    email_body: str,
    email_html: str | None,
    attachments: list[dict],  # [{filename, storage_path, content_type}]
):
    """Create extraction tools bound to a specific email's content."""

    full_content = f"SUBJECT: {email_subject}\n\nBODY:\n{email_body}"
    if email_html:
        full_content += f"\n\nHTML VERSION:\n{email_html}"

    # Pre-extract text from all attachments
    attachment_texts: dict[str, str] = {}
    if attachments:
        full_content += f"\n\nATTACHMENTS ({len(attachments)}):"
        for att in attachments:
            filename = att["filename"]
            full_content += f"\n  - {filename}"
            text = _extract_attachment_text(att["storage_path"], att["content_type"])
            attachment_texts[filename] = text
            log.info("attachment_text_extracted", filename=filename, chars=len(text))

    # Build a combined content that includes attachment text
    full_with_attachments = full_content
    for filename, text in attachment_texts.items():
        full_with_attachments += f"\n\n{'='*60}\nATTACHMENT CONTENT: {filename}\n{'='*60}\n{text}"

    @tool
    def read_email() -> str:
        """Read the full email content including subject, body, and extracted text from all PDF attachments."""
        return full_with_attachments

    @tool
    def read_attachment(filename: str) -> str:
        """Read the extracted text content of a specific attachment by filename.

        Args:
            filename: The attachment filename (e.g. "01_complete_gl_application.pdf")
        """
        if filename in attachment_texts:
            return f"CONTENT OF {filename}:\n\n{attachment_texts[filename]}"
        available = list(attachment_texts.keys())
        return f"Attachment '{filename}' not found. Available: {available}"

    @tool
    def get_extraction_schema() -> str:
        """Get the full JSON schema that the final extraction must conform to."""
        return json.dumps(ExtractedSubmission.model_json_schema(), indent=2)

    @tool
    def submit_extraction(extraction_json: str) -> str:
        """Submit the final extracted data as a JSON string. This MUST conform to the extraction schema.

        Args:
            extraction_json: The complete extraction result as a JSON string.
        """
        try:
            data = json.loads(extraction_json)
            ExtractedSubmission.model_validate(data)
            return "EXTRACTION_ACCEPTED: " + extraction_json
        except Exception as e:
            return f"EXTRACTION_REJECTED: Invalid format — {e}. Please fix and resubmit."

    return [read_email, read_attachment, get_extraction_schema, submit_extraction]


AGENT_SYSTEM_PROMPT = """\
You are an insurance submission data extraction agent. Your job is to extract \
the MAXIMUM amount of structured data from broker emails.

WORKFLOW:
1. Call read_email — this returns the email body AND the full text extracted from all PDF attachments
2. Call get_extraction_schema to understand the exact output format
3. If you need to re-read a specific attachment, call read_attachment with the filename
4. Extract ALL available information — be aggressive, capture everything from BOTH email and attachments
5. Call submit_extraction with the complete JSON
6. If rejected, fix and resubmit

IMPORTANT: The read_email tool returns ALL attachment text already included. Read it carefully — \
the PDF content contains the detailed application data, loss run records, and other critical information.

CRITICAL EXTRACTION RULES:

FACILITIES — ALWAYS extract at least one:
- The insured's mailing address counts as a facility (type: "mailing" or "primary")
- Any address mentioned in the email or referenced from attachments is a facility
- If you see a street address, city, state, or ZIP anywhere, create a facility record
- Business addresses, office locations, job sites — all count as facilities
- NEVER return an empty facilities array if any address appears in the email

LOSS RUNS — Extract ALL records even if incomplete:
- If loss runs are mentioned at all, set present=true
- Create a period record for EVERY policy period mentioned, even with partial data
- If a period has no claims, still create the record with total_claims=0
- Count the actual number of distinct policy periods to set years_covered
- For the summary, add up all periods. If you can't calculate loss_ratio, leave it ""
- Mark any field you had to guess or couldn't find in missing_fields
- NEVER skip a loss run period just because some fields are empty

BROKER — Extract from email signature:
- The person sending the email is usually the broker
- Look for name, company, email, phone in the email signature block
- The "From" header email address is the broker's email
- Also check for lines like "Thanks, [Name]" or "Best regards, [Name]"

CONTACTS — Capture everyone mentioned:
- The insured contact person (from the application)
- The broker (from the email signature)
- Any other names with roles mentioned

MISSING FIELDS — Be specific and helpful:
- List each missing field as a human-readable description, not a JSON key
- Example: "Insured FEIN number" not "overview.fein"
- Example: "Loss runs for 2022-2023 period" not "loss_runs.periods[2]"
- Group related missing items (e.g., "Complete facility address — missing city and ZIP")

GENERAL:
- Extract from BOTH the email body and any referenced attachment content
- For monetary values, keep original format (e.g., "$1,000,000")
- For genuinely missing data, use "" for text, 0 for numbers, false for booleans
- Set confidence 0.0-1.0 based on completeness (0.9+ = nearly all fields filled)
- Add warnings for ambiguous or inconsistent data
- This data drives underwriting decisions — more data is always better
"""


# ---------------------------------------------------------------------------
# Agent state and graph
# ---------------------------------------------------------------------------


class ExtractionAgentState(TypedDict):
    messages: Annotated[list[BaseMessage], operator.add]


def _build_extraction_graph(tools: list, settings: Settings):
    """Build a LangGraph extraction agent."""
    llm = ChatAnthropic(
        model=settings.extraction_model,
        anthropic_api_key=settings.anthropic_api_key,
        temperature=0,
        max_tokens=8192,
    ).bind_tools(tools)

    tool_node = ToolNode(tools)

    def call_model(state: ExtractionAgentState) -> dict:
        messages = state["messages"]
        if not messages or not isinstance(messages[0], SystemMessage):
            messages = [SystemMessage(content=AGENT_SYSTEM_PROMPT)] + messages
        response = llm.invoke(messages)
        return {"messages": [response]}

    def should_continue(state: ExtractionAgentState) -> str:
        last = state["messages"][-1]
        if hasattr(last, "tool_calls") and last.tool_calls:
            return "tools"
        return END

    graph = StateGraph(ExtractionAgentState)
    graph.add_node("agent", call_model)
    graph.add_node("tools", tool_node)
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    graph.add_edge("tools", "agent")

    return graph.compile()


# ---------------------------------------------------------------------------
# Main extraction function
# ---------------------------------------------------------------------------


async def extract_submission_data(
    submission_id: str,
    *,
    store: JsonStore,
    settings: Settings,
) -> ExtractionResult:
    """Run the extraction agent on a submission."""
    submission = store.load("submissions", submission_id, Submission)
    if submission is None:
        raise ValueError(f"Submission {submission_id} not found")

    # Transition to EXTRACTING
    if submission.status in (
        SubmissionStatus.RECEIVED,
        SubmissionStatus.ACK_SENT,
        SubmissionStatus.PARSING,
    ):
        submission.status = SubmissionStatus.EXTRACTING
        store.save("submissions", submission.id, submission)
    elif submission.status != SubmissionStatus.EXTRACTING:
        from submission_platform.domain.workflow import validate_transition
        validate_transition(submission.status, SubmissionStatus.EXTRACTING)
        submission.status = SubmissionStatus.EXTRACTING
        store.save("submissions", submission.id, submission)

    log.info("extraction_started", submission_id=submission.id, model=settings.extraction_model)

    # Create tools bound to this email's content + attachment text
    attachment_info = [
        {
            "filename": a.filename,
            "storage_path": a.storage_path,
            "content_type": a.content_type,
        }
        for a in submission.attachments
    ]
    tools = _make_extraction_tools(
        submission.subject, submission.body_text, submission.body_html, attachment_info
    )

    try:
        # Build and run the agent graph
        graph = _build_extraction_graph(tools, settings)
        initial_state = {
            "messages": [
                HumanMessage(
                    content="Please extract all structured data from this insurance submission email. "
                    "Start by reading the email, then extract the data and submit it."
                )
            ]
        }

        final_state = await graph.ainvoke(initial_state)

        # Find the accepted extraction from tool responses
        extracted = _find_accepted_extraction(final_state["messages"])

        if extracted:
            validated = ExtractedSubmission.model_validate(extracted)
            result_data = validated.model_dump()
            confidence = result_data.get("confidence", 0.5)
            missing_fields = result_data.get("missing_fields", [])
            warnings = result_data.get("warnings", [])
        else:
            # Fallback: try to parse from the last assistant message
            result_data = _fallback_parse(final_state["messages"])
            confidence = result_data.get("confidence", 0.3)
            missing_fields = result_data.get("missing_fields", ["parse_fallback"])
            warnings = result_data.get("warnings", []) + ["Used fallback parsing"]

        result = ExtractionResult(
            data=result_data,
            missing_fields=missing_fields,
            confidence=confidence,
            evidence=[],
            warnings=warnings,
        )

        log.info(
            "extraction_completed",
            submission_id=submission.id,
            confidence=confidence,
            missing_count=len(missing_fields),
            model=settings.extraction_model,
        )

    except Exception as e:
        log.error("extraction_failed", submission_id=submission.id, error=str(e))
        result = ExtractionResult(
            data={"error": str(e), "raw_body": submission.body_text[:500]},
            missing_fields=["all"],
            confidence=0.0,
            evidence=[],
            warnings=[f"Extraction failed: {e}"],
        )

    submission.extracted_data = result.data
    submission.extraction_confidence = result.confidence
    submission.status = SubmissionStatus.EXTRACTED
    store.save("submissions", submission.id, submission)

    return result


def _find_accepted_extraction(messages: list) -> dict | None:
    """Scan tool responses for an EXTRACTION_ACCEPTED result."""
    for msg in reversed(messages):
        content = getattr(msg, "content", "")
        if isinstance(content, str) and "EXTRACTION_ACCEPTED:" in content:
            json_str = content.split("EXTRACTION_ACCEPTED:", 1)[1].strip()
            return json.loads(json_str)
        if isinstance(content, list):
            for block in content:
                text = block if isinstance(block, str) else block.get("text", "")
                if "EXTRACTION_ACCEPTED:" in text:
                    json_str = text.split("EXTRACTION_ACCEPTED:", 1)[1].strip()
                    return json.loads(json_str)
    return None


def _fallback_parse(messages: list) -> dict:
    """Last resort: try to extract JSON from the final assistant message."""
    for msg in reversed(messages):
        content = getattr(msg, "content", "")
        if isinstance(content, list):
            content = " ".join(
                b if isinstance(b, str) else b.get("text", "") for b in content
            )
        if isinstance(content, str) and "{" in content:
            try:
                start = content.index("{")
                end = content.rindex("}") + 1
                return json.loads(content[start:end])
            except (json.JSONDecodeError, ValueError):
                pass
    return {"error": "Could not parse extraction", "raw": "fallback failed"}
