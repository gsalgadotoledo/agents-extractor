"""Generate advanced test PDF fixtures - complex scenarios and edge cases."""
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


# --- 06: Multi-location facility with high loss history ---
make_pdf(
    "06_multi_location_high_risk.pdf",
    "COMMERCIAL GL APPLICATION - MULTI-LOCATION",
    [
        "## Applicant Information",
        "Named Insured: Sunrise Senior Living Group LLC",
        "DBA: Sunrise Care Centers",
        "FEIN: 76-9988771",
        "Business Type: LLC",
        "Year Established: 2010",
        "Number of Employees: 320",
        "Annual Revenue: $28,500,000",
        "SIC Code: 8051",
        "NAICS Code: 623110",
        "Description of Operations: Assisted living facilities providing residential care for seniors including memory care, skilled nursing, and rehabilitation services across multiple locations.",
        "---",
        "## Facility Locations",
        "Location 1 - Sunrise at Oakwood",
        "Address: 4500 Oakwood Blvd, Dallas, TX 75219",
        "Type: Assisted Living - 120 beds",
        "Year Opened: 2010",
        "---",
        "Location 2 - Sunrise at Lakeside",
        "Address: 8901 Lake Shore Dr, Plano, TX 75024",
        "Type: Memory Care - 60 beds",
        "Year Opened: 2015",
        "---",
        "Location 3 - Sunrise at Meadows",
        "Address: 2200 Meadow Creek Pkwy, Frisco, TX 75034",
        "Type: Skilled Nursing - 80 beds",
        "Year Opened: 2018",
        "---",
        "Location 4 - Sunrise at River Walk (UNDER CONSTRUCTION)",
        "Address: 1100 River Walk Ave, Fort Worth, TX 76102",
        "Type: Assisted Living - 100 beds (opening Q3 2026)",
        "---",
        "## Coverage Requested",
        "Policy Type: Commercial General Liability",
        "Effective Date: 07/01/2026",
        "Expiration Date: 07/01/2027",
        "Each Occurrence Limit: $2,000,000",
        "General Aggregate: $4,000,000",
        "Products/Completed Ops: $4,000,000",
        "Professional Liability: $2,000,000",
        "Abuse & Molestation: $1,000,000",
        "---",
        "## Prior Insurance",
        "Current Carrier: Great American Insurance Group",
        "Policy Number: CGL-2025-44210",
        "Current Premium: $165,000",
        "---",
        "## Signature",
        "Applicant: Patricia Mendes, CFO",
        "Broker: Alliance Risk Partners",
        "Broker Contact: Michael Torres, mtorres@alliancerisk.com, (469) 555-0188",
    ],
)


# --- 07: Loss runs with open claims and high severity ---
make_pdf(
    "07_loss_runs_high_severity.pdf",
    "LOSS RUN REPORT - HIGH SEVERITY",
    [
        "## Carrier: Great American Insurance Group",
        "Insured: Sunrise Senior Living Group LLC",
        "Report Date: 06/01/2026",
        "---",
        "## Policy Period: 07/01/2025 - 07/01/2026",
        "Policy Number: CGL-2025-44210",
        "Claim 1: Date of Loss 09/15/2025",
        "Claimant: Estate of Harold Peterson",
        "Description: Wrongful death claim - resident fall from second floor balcony at Lakeside facility",
        "Status: OPEN - In Litigation",
        "Reserve: $750,000",
        "Total Incurred: $850,000",
        "Total Paid: $100,000 (defense costs)",
        "---",
        "Claim 2: Date of Loss 11/22/2025",
        "Claimant: Dorothy Williams",
        "Description: Medication error at Oakwood facility. Patient received incorrect dosage.",
        "Status: OPEN - Negotiating settlement",
        "Reserve: $200,000",
        "Total Incurred: $245,000",
        "Total Paid: $45,000",
        "---",
        "Claim 3: Date of Loss 01/08/2026",
        "Claimant: Robert Chen family",
        "Description: Alleged neglect - pressure ulcer developed during stay at Meadows facility",
        "Status: OPEN",
        "Reserve: $150,000",
        "Total Incurred: $150,000",
        "Total Paid: $0",
        "---",
        "Period Summary: 3 claims, $1,245,000 total incurred, $145,000 paid, 3 open",
        "---",
        "## Policy Period: 07/01/2024 - 07/01/2025",
        "Policy Number: CGL-2024-38109",
        "Claim 1: Date of Loss 10/03/2024",
        "Description: Slip and fall - visitor in Oakwood lobby",
        "Status: Closed",
        "Total Incurred: $35,000",
        "Total Paid: $35,000",
        "---",
        "Claim 2: Date of Loss 02/14/2025",
        "Description: Property damage - water leak at Lakeside affecting neighboring business",
        "Status: Closed",
        "Total Incurred: $18,500",
        "Total Paid: $18,500",
        "---",
        "Period Summary: 2 claims, $53,500 total incurred, $53,500 paid, 0 open",
        "---",
        "## Policy Period: 07/01/2023 - 07/01/2024",
        "Policy Number: CGL-2023-29087",
        "Claim 1: Date of Loss 12/20/2023",
        "Description: Abuse allegation - caregiver at Meadows (investigated, unfounded)",
        "Status: Closed - No payment",
        "Total Incurred: $85,000 (defense only)",
        "Total Paid: $85,000",
        "---",
        "Period Summary: 1 claim, $85,000 total incurred, $85,000 paid, 0 open",
        "---",
        "## Policy Period: 07/01/2022 - 07/01/2023",
        "Policy Number: CGL-2022-20165",
        "No claims reported.",
        "---",
        "## 4-Year Summary",
        "Total Claims: 6",
        "Total Incurred: $1,383,500",
        "Total Paid: $283,500",
        "Open Claims: 3",
        "Open Reserves: $1,100,000",
        "Loss Ratio: 47.2%",
    ],
)


# --- 08: Renewal with changed coverage limits ---
make_pdf(
    "08_renewal_changed_limits.pdf",
    "RENEWAL APPLICATION - COVERAGE CHANGE REQUEST",
    [
        "## Renewal Notice",
        "This is a renewal application with CHANGES to the current policy.",
        "---",
        "## Current Policy",
        "Named Insured: Metro Construction Services Inc",
        "Policy Number: GL-2025-55321",
        "Current Carrier: Travelers",
        "Current Premium: $42,000",
        "Current Limits: $1M/$2M",
        "Expiration: 08/15/2026",
        "---",
        "## Requested Changes",
        "Increase Each Occurrence from $1,000,000 to $2,000,000",
        "Increase General Aggregate from $2,000,000 to $5,000,000",
        "Add Umbrella/Excess: $5,000,000",
        "Reason: New contract with City of Austin requires higher limits",
        "---",
        "## Applicant Information",
        "Named Insured: Metro Construction Services Inc",
        "FEIN: 74-5566778",
        "Business Type: Corporation",
        "Year Established: 2005",
        "Number of Employees: 85",
        "Annual Revenue: $12,000,000",
        "Description: General contractor - commercial and residential construction, renovation, and remodeling",
        "---",
        "## Contact",
        "Insured Contact: David Park, dpark@metroconstruction.com, (512) 555-0234",
        "Broker: Capital Insurance Group",
        "Broker Contact: Jennifer Walsh, jwalsh@capitalins.com, (512) 555-0199",
    ],
)


# --- 09: Submission in Spanish (language edge case) ---
make_pdf(
    "09_spanish_submission.pdf",
    "SOLICITUD DE SEGURO - RESPONSABILIDAD CIVIL GENERAL",
    [
        "## Informacion del Solicitante",
        "Nombre del Asegurado: Clinica Dental Sonrisa Perfecta S.A. de C.V.",
        "Direccion: 456 Commerce St, Suite 300, San Antonio, TX 78205",
        "Contacto: Dr. Ricardo Gutierrez",
        "Telefono: (210) 555-0177",
        "Correo: rgutierrez@sonrisaperfecta.com",
        "FEIN: 82-1122334",
        "---",
        "## Informacion del Negocio",
        "Tipo de Negocio: S-Corp",
        "Ano de Establecimiento: 2019",
        "Numero de Empleados: 12",
        "Ingresos Anuales: $1,800,000",
        "Descripcion: Clinica dental con servicios de odontologia general, ortodoncia y cirugia oral",
        "---",
        "## Cobertura Solicitada",
        "Tipo de Poliza: Responsabilidad Civil General (Commercial General Liability)",
        "Fecha Efectiva: 06/01/2026",
        "Limite por Ocurrencia: $1,000,000",
        "Agregado General: $2,000,000",
        "---",
        "## Historial de Reclamaciones",
        "Sin reclamaciones en los ultimos 5 anos",
        "---",
        "## Seguro Previo",
        "Aseguradora Actual: Zurich",
        "Prima Actual: $8,200",
        "---",
        "Firma: Dr. Ricardo Gutierrez",
        "Fecha: 05/15/2026",
        "Corredor: Seguros del Valle",
        "Contacto del Corredor: Ana Ramirez, aramirez@segurosdelvalle.com",
    ],
)


# --- 10: Multiple insured entities (complex structure) ---
make_pdf(
    "10_multiple_entities.pdf",
    "COMMERCIAL GL APPLICATION - MULTIPLE NAMED INSUREDS",
    [
        "## Named Insureds (All to be included on policy)",
        "1. Hartfield Holdings LLC (Parent Company)",
        "   FEIN: 91-7788990",
        "   Address: 100 Corporate Plaza, Houston, TX 77002",
        "---",
        "2. Hartfield Property Management Inc (Subsidiary)",
        "   FEIN: 91-7788991",
        "   Address: 100 Corporate Plaza, Suite 200, Houston, TX 77002",
        "---",
        "3. Hartfield Maintenance Services LLC (Subsidiary)",
        "   FEIN: 91-7788992",
        "   Address: 5500 Industrial Blvd, Houston, TX 77045",
        "---",
        "4. HF Restaurant Group LLC (Subsidiary)",
        "   FEIN: 91-7788993",
        "   Address: 200 Dining Ave, Houston, TX 77019",
        "---",
        "## Business Description",
        "Hartfield Holdings is a diversified company operating commercial real estate, property management, facility maintenance, and food service businesses.",
        "Total Employees (all entities): 450",
        "Combined Annual Revenue: $67,000,000",
        "---",
        "## Managed Properties (Facilities)",
        "Hartfield Tower - 100 Corporate Plaza, Houston, TX 77002 (Office, 30 floors)",
        "Galleria West Mall - 3300 Westheimer Rd, Houston, TX 77056 (Retail, 200 tenants)",
        "Harbor Point Apartments - 800 Harbor Dr, Galveston, TX 77550 (Residential, 240 units)",
        "Bayou Business Park - 12000 Bayou Rd, Pasadena, TX 77506 (Industrial, 15 warehouses)",
        "Downtown Food Hall - 200 Dining Ave, Houston, TX 77019 (Restaurant, 8 concepts)",
        "---",
        "## Coverage Requested",
        "Policy Type: Commercial General Liability (Wrap-up for all entities)",
        "Effective Date: 09/01/2026",
        "Each Occurrence: $5,000,000",
        "General Aggregate: $10,000,000",
        "Umbrella/Excess: $25,000,000",
        "---",
        "## Contact",
        "CFO: Margaret Hartfield, mhartfield@hartfieldholdings.com",
        "Risk Manager: Thomas Lee, tlee@hartfieldholdings.com, (713) 555-0300",
        "Broker: Marsh McLennan",
        "Broker Contact: Steven Rodriguez, steven.rodriguez@marsh.com, (713) 555-0400",
    ],
)


# --- 11: Minimum viable submission (bare bones) ---
make_pdf(
    "11_bare_minimum.pdf",
    "GL APPLICATION",
    [
        "Company: Joe's Lawn Care",
        "Need GL insurance ASAP",
        "1 million dollar coverage",
        "Start date: next Monday",
        "Phone: 555-0100",
        "Joe Martinez",
    ],
)


# --- 12: Contradictory information ---
make_pdf(
    "12_contradictory_info.pdf",
    "COMMERCIAL GL APPLICATION",
    [
        "## Applicant",
        "Named Insured: Pacific Coast Medical Group",
        "DBA: Pacific Coast Wellness (NOTE: DBA may be outdated, company rebranded to Pacific Health Partners in 2025)",
        "FEIN: 95-1234567",
        "---",
        "## Business Info",
        "Business Type: Partnership (NOTE: Converting to LLC effective June 2026)",
        "Year Established: 2017",
        "Number of Employees: 25 (NOTE: Expanding to 40 by Q4 2026, hire in progress)",
        "Annual Revenue: $3,200,000 (projected $4,500,000 for 2026-2027 policy year)",
        "---",
        "## Coverage Requested",
        "Policy Type: Commercial General Liability + Professional Liability",
        "Effective Date: 07/01/2026",
        "Each Occurrence: $1,000,000 (considering increasing to $2M - please quote both)",
        "General Aggregate: $2,000,000",
        "---",
        "## Locations",
        "Current: 500 Pacific Ave, Santa Monica, CA 90401",
        "Opening Q3 2026: 1200 Wilshire Blvd, Los Angeles, CA 90025 (lease signed but not yet occupied)",
        "Closing: 300 Venice Blvd, Venice, CA 90291 (closing end of June 2026)",
        "---",
        "## Notes",
        "Prior carrier (Hartford) is non-renewing due to class of business.",
        "No claims in past 3 years but there was a regulatory inquiry in 2024 (resolved, no fine).",
        "Broker: West Coast Insurance Advisors",
        "Broker Contact: Lisa Nguyen, lnguyen@wcinsurance.com",
    ],
)

print("\nAll advanced test PDFs created!")
print(f"Location: {OUTPUT_DIR.resolve()}")
