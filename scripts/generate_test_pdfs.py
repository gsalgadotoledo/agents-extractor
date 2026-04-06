"""Generate test PDF fixtures for insurance submission testing."""
from fpdf import FPDF
from pathlib import Path

OUTPUT_DIR = Path("tests/fixtures/attachments")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def make_pdf(filename: str, title: str, lines: list[str]) -> Path:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 12, title, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_font("Helvetica", "", 11)
    for line in lines:
        text = line.strip()
        if not text or line.startswith("---"):
            pdf.ln(4)
        elif line.startswith("##"):
            pdf.set_font("Helvetica", "B", 13)
            pdf.cell(0, 8, text.replace("## ", ""), new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 11)
        else:
            pdf.multi_cell(0, 6, text, new_x="LMARGIN", new_y="NEXT")
    path = OUTPUT_DIR / filename
    pdf.output(str(path))
    print(f"  Created: {path}")
    return path


# --- PDF 1: Complete GL Application ---
make_pdf(
    "01_complete_gl_application.pdf",
    "COMMERCIAL GENERAL LIABILITY APPLICATION",
    [
        "## Applicant Information",
        "Named Insured: Acme Healthcare Solutions LLC",
        "DBA: Acme Care",
        "Mailing Address: 1234 Medical Pkwy, Suite 200, Austin, TX 78701",
        "Contact Person: Maria Rodriguez",
        "Phone: (512) 555-0142",
        "Email: mrodriguez@acmecare.com",
        "FEIN: 84-1234567",
        "---",
        "## Business Information",
        "Business Type: LLC",
        "Year Established: 2018",
        "SIC Code: 8011",
        "NAICS Code: 621111",
        "Number of Employees: 45",
        "Annual Revenue: $4,200,000",
        "Description of Operations: Outpatient medical clinic providing primary care, urgent care, and minor surgical procedures.",
        "---",
        "## Coverage Requested",
        "Policy Type: Commercial General Liability",
        "Effective Date: 05/01/2026",
        "Expiration Date: 05/01/2027",
        "Each Occurrence Limit: $1,000,000",
        "General Aggregate: $2,000,000",
        "Products/Completed Ops: $2,000,000",
        "Personal & Advertising Injury: $1,000,000",
        "Fire Damage (any one fire): $100,000",
        "Medical Expense (any one person): $10,000",
        "---",
        "## Prior Insurance",
        "Current Carrier: National Indemnity Co",
        "Policy Number: GL-2024-88421",
        "Expiration: 05/01/2026",
        "Premium: $18,500",
        "---",
        "## Claims History",
        "Any claims in the past 5 years: Yes",
        "Claim 1: 03/2024 - Slip and fall in waiting room. Settled $12,000.",
        "Claim 2: None other.",
        "---",
        "## Signature",
        "Applicant Signature: Maria Rodriguez",
        "Date: 03/20/2026",
        "Broker: Johnson & Associates Insurance",
        "Broker Contact: David Johnson, djohnson@johnsonins.com",
    ],
)


# --- PDF 2: Loss Runs (4 years) ---
make_pdf(
    "02_loss_runs_4_years.pdf",
    "LOSS RUN REPORT",
    [
        "## Carrier: National Indemnity Company",
        "Insured: Acme Healthcare Solutions LLC",
        "Policy Type: Commercial General Liability",
        "Report Date: 03/15/2026",
        "---",
        "## Policy Period: 05/01/2025 - 05/01/2026",
        "Policy Number: GL-2024-88421",
        "Total Incurred: $0",
        "Total Paid: $0",
        "Open Claims: 0",
        "Status: No losses reported",
        "---",
        "## Policy Period: 05/01/2024 - 05/01/2025",
        "Policy Number: GL-2023-77312",
        "Claim 1: Date of Loss 03/14/2024",
        "  Claimant: Patricia Hawkins",
        "  Description: Slip and fall in waiting room",
        "  Status: Closed",
        "  Total Incurred: $12,000",
        "  Total Paid: $12,000",
        "  Reserve: $0",
        "---",
        "## Policy Period: 05/01/2023 - 05/01/2024",
        "Policy Number: GL-2022-65203",
        "Total Incurred: $0",
        "Total Paid: $0",
        "Open Claims: 0",
        "Status: No losses reported",
        "---",
        "## Policy Period: 05/01/2022 - 05/01/2023",
        "Policy Number: GL-2021-54194",
        "Total Incurred: $0",
        "Total Paid: $0",
        "Open Claims: 0",
        "Status: No losses reported",
        "---",
        "## Summary (4 Years)",
        "Total Claims: 1",
        "Total Incurred: $12,000",
        "Total Paid: $12,000",
        "Loss Ratio: 6.5%",
    ],
)


# --- PDF 3: Application WITHOUT loss runs (auto-policy path) ---
make_pdf(
    "03_small_business_application_no_loss_runs.pdf",
    "GENERAL LIABILITY APPLICATION - NEW BUSINESS",
    [
        "## Applicant Information",
        "Named Insured: Bright Pixel Design Studio",
        "Mailing Address: 789 Creative Ave, Brooklyn, NY 11201",
        "Contact Person: James Chen",
        "Phone: (718) 555-0199",
        "Email: james@brightpixel.design",
        "FEIN: 92-7654321",
        "---",
        "## Business Information",
        "Business Type: S-Corp",
        "Year Established: 2024",
        "Number of Employees: 3",
        "Annual Revenue: $320,000",
        "Description of Operations: Graphic design and branding studio. No physical client visits. Work performed remotely.",
        "---",
        "## Coverage Requested",
        "Policy Type: Commercial General Liability",
        "Effective Date: 04/15/2026",
        "Each Occurrence Limit: $500,000",
        "General Aggregate: $1,000,000",
        "---",
        "## Prior Insurance",
        "Current Carrier: None - First time buyer",
        "---",
        "## Claims History",
        "Any claims in the past 5 years: No",
        "Loss runs: Not available (new business, no prior GL policy)",
        "---",
        "## Signature",
        "Applicant Signature: James Chen",
        "Date: 03/22/2026",
        "Broker: QuickQuote Online Brokers",
        "Broker Contact: Sarah Kim, skim@quickquote.io",
    ],
)


# --- PDF 4: Incomplete application (missing fields) ---
make_pdf(
    "04_incomplete_application.pdf",
    "GENERAL LIABILITY APPLICATION",
    [
        "## Applicant Information",
        "Named Insured: [BLANK]",
        "Mailing Address: 456 Oak St",
        "Contact Person: Tom",
        "Phone: (left blank)",
        "Email: tom@something",
        "---",
        "## Business Information",
        "Business Type: (not specified)",
        "Year Established: (not specified)",
        "Number of Employees: ~10",
        "Annual Revenue: not sure, maybe 500k?",
        "Description of Operations: We do stuff with computers",
        "---",
        "## Coverage Requested",
        "Policy Type: GL I think",
        "Effective Date: ASAP",
        "Limits: standard",
        "---",
        "## Prior Insurance",
        "Had insurance before but don't remember carrier name",
        "---",
        "## Claims History",
        "Not sure",
        "---",
        "NOTE: This application is incomplete. Multiple required fields are missing.",
    ],
)


# --- PDF 5: Loss Runs (only 2 years - partial) ---
make_pdf(
    "05_loss_runs_2_years_partial.pdf",
    "LOSS RUN REPORT (PARTIAL)",
    [
        "## Carrier: Midwest Mutual Insurance",
        "Insured: Riverdale Plumbing Services Inc",
        "Policy Type: Commercial General Liability",
        "Report Date: 03/10/2026",
        "---",
        "## Policy Period: 06/01/2025 - 06/01/2026",
        "Policy Number: CGL-2025-4411",
        "Total Incurred: $45,000",
        "Total Paid: $30,000",
        "Open Claims: 1",
        "Claim 1: Date of Loss 11/02/2025",
        "  Description: Water damage to client property during pipe installation",
        "  Status: Open",
        "  Reserve: $15,000",
        "---",
        "## Policy Period: 06/01/2024 - 06/01/2025",
        "Policy Number: CGL-2024-3302",
        "Total Incurred: $8,500",
        "Total Paid: $8,500",
        "Open Claims: 0",
        "Claim 1: Date of Loss 01/18/2025",
        "  Description: Third party injury at job site",
        "  Status: Closed",
        "---",
        "## Note",
        "Only 2 years of loss history available.",
        "Prior carrier (years 2022-2024) is no longer in business.",
        "Loss runs for those years are unavailable.",
    ],
)

print("\nAll test PDFs created successfully!")
print(f"Location: {OUTPUT_DIR.resolve()}")
print("\nTest scenarios:")
print("  01 + 02: Complete app WITH 4yr loss runs -> should route to MANUAL REVIEW")
print("  03:      New business, NO loss runs     -> should route to AUTO POLICY")
print("  04:      Incomplete application          -> should FAIL validation")
print("  05:      Only 2yr loss runs (partial)    -> should route to AUTO POLICY")
