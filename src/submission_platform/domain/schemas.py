"""Extraction schemas — Pydantic models for structured data extracted from submissions."""
from __future__ import annotations

from pydantic import BaseModel, Field


class OverviewData(BaseModel):
    insured_name: str = ""
    dba: str = ""
    fein: str = ""
    business_type: str = ""
    year_established: str = ""
    number_of_employees: str = ""
    annual_revenue: str = ""
    description_of_operations: str = ""
    sic_code: str = ""
    naics_code: str = ""


class BrokerData(BaseModel):
    name: str = ""
    company: str = ""
    email: str = ""
    phone: str = ""


class FacilityData(BaseModel):
    address: str = ""
    city: str = ""
    state: str = ""
    zip: str = ""
    type: str = ""
    notes: str = ""


class CoverageData(BaseModel):
    policy_type: str = ""
    effective_date: str = ""
    expiration_date: str = ""
    each_occurrence_limit: str = ""
    general_aggregate: str = ""
    products_completed_ops: str = ""
    personal_advertising_injury: str = ""
    fire_damage: str = ""
    medical_expense: str = ""


class LossRunPeriod(BaseModel):
    period: str = ""
    policy_number: str = ""
    carrier: str = ""
    total_claims: int = 0
    total_incurred: str = ""
    total_paid: str = ""
    open_claims: int = 0
    status: str = ""


class LossRunSummary(BaseModel):
    total_claims: int = 0
    total_incurred: str = ""
    total_paid: str = ""
    loss_ratio: str = ""


class LossRunsData(BaseModel):
    present: bool = False
    years_covered: int = 0
    periods: list[LossRunPeriod] = []
    summary: LossRunSummary = Field(default_factory=LossRunSummary)


class PriorInsuranceData(BaseModel):
    carrier: str = ""
    policy_number: str = ""
    expiration: str = ""
    premium: str = ""


class ClaimData(BaseModel):
    date: str = ""
    description: str = ""
    amount: str = ""
    status: str = ""


class ContactData(BaseModel):
    name: str = ""
    role: str = ""
    email: str = ""
    phone: str = ""


class ExtractedSubmission(BaseModel):
    """Full extracted submission data — the target schema for the extraction agent."""
    overview: OverviewData = Field(default_factory=OverviewData)
    broker: BrokerData = Field(default_factory=BrokerData)
    facilities: list[FacilityData] = []
    coverage: CoverageData = Field(default_factory=CoverageData)
    loss_runs: LossRunsData = Field(default_factory=LossRunsData)
    prior_insurance: PriorInsuranceData = Field(default_factory=PriorInsuranceData)
    claims_history: list[ClaimData] = []
    contacts: list[ContactData] = []
    missing_fields: list[str] = []
    warnings: list[str] = []
    confidence: float = 0.0
