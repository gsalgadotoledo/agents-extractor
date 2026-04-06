"""Dynamic missing fields calculation — computed from extracted data, not stored."""
from __future__ import annotations

# Each field: (dot_path, label, section, required)
ALL_FIELDS: list[tuple[str, str, str, bool]] = [
    # Applicant
    ("overview.insured_name", "Insured name", "applicant", True),
    ("overview.dba", "DBA name", "applicant", False),
    ("overview.fein", "FEIN number", "applicant", True),
    ("overview.business_type", "Business type", "applicant", True),
    ("overview.year_established", "Year established", "applicant", False),
    ("overview.number_of_employees", "Number of employees", "applicant", True),
    ("overview.annual_revenue", "Annual revenue", "applicant", True),
    ("overview.description_of_operations", "Description of operations", "applicant", False),
    ("overview.sic_code", "SIC code", "applicant", False),
    ("overview.naics_code", "NAICS code", "applicant", False),
    # Broker
    ("broker.name", "Broker name", "broker", True),
    ("broker.email", "Broker email", "broker", True),
    ("broker.company", "Broker company", "broker", False),
    ("broker.phone", "Broker phone", "broker", False),
    # Coverage
    ("coverage.policy_type", "Coverage type", "coverage", True),
    ("coverage.effective_date", "Effective date", "coverage", True),
    ("coverage.expiration_date", "Expiration date", "coverage", False),
    ("coverage.each_occurrence_limit", "Each occurrence limit", "coverage", True),
    ("coverage.general_aggregate", "General aggregate limit", "coverage", True),
    ("coverage.products_completed_ops", "Products/completed ops limit", "coverage", False),
    ("coverage.personal_advertising_injury", "Personal & advertising injury limit", "coverage", False),
    ("coverage.fire_damage", "Fire damage limit", "coverage", False),
    ("coverage.medical_expense", "Medical expense limit", "coverage", False),
    # Prior insurance
    ("prior_insurance.carrier", "Prior insurance carrier", "prior_insurance", False),
    ("prior_insurance.policy_number", "Prior policy number", "prior_insurance", False),
    ("prior_insurance.premium", "Prior premium", "prior_insurance", False),
]


def _get_nested(data: dict, path: str) -> str:
    parts = path.split(".")
    current = data
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part, "")
        else:
            return ""
    return str(current) if current else ""


def compute_missing_fields(extracted_data: dict | None) -> dict:
    """Compute missing fields dynamically from extracted data."""
    fields = []
    for path, label, section, required in ALL_FIELDS:
        val = _get_nested(extracted_data, path) if extracted_data else ""
        filled = bool(val and val not in ("\u2014", "0", "null", "None", ""))
        fields.append({
            "path": path,
            "label": label,
            "section": section,
            "required": required,
            "filled": filled,
            "value": val if filled else None,
        })

    required_missing = [f for f in fields if f["required"] and not f["filled"]]
    recommended_missing = [f for f in fields if not f["required"] and not f["filled"]]
    total = len(fields)
    filled = sum(1 for f in fields if f["filled"])

    facilities = extracted_data.get("facilities", []) if extracted_data else []
    loss_runs = extracted_data.get("loss_runs", {}) if extracted_data else {}

    return {
        "fields": fields,
        "required_missing": required_missing,
        "recommended_missing": recommended_missing,
        "total_required": len(required_missing),
        "total_recommended": len(recommended_missing),
        "total_fields": total,
        "filled_fields": filled,
        "completion_pct": filled / total if total > 0 else 0.0,
        "has_facilities": len(facilities) > 0 if isinstance(facilities, list) else False,
        "has_loss_runs": bool(loss_runs.get("present")) if isinstance(loss_runs, dict) else False,
    }
