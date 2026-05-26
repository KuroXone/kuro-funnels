from pydantic import BaseModel, field_validator, computed_field
from typing import Optional, List
from datetime import datetime


class DomainCreate(BaseModel):
    domain: str
    dkim_selector: str = "kuro"

    @field_validator("domain")
    @classmethod
    def clean_domain(cls, v: str) -> str:
        return v.lower().strip().removeprefix("https://").removeprefix("http://").split("/")[0]


class DomainUpdate(BaseModel):
    warmup_enabled: Optional[bool] = None
    dkim_selector: Optional[str] = None
    tracking_cname: Optional[str] = None
    bounce_subdomain: Optional[str] = None


class DnsRecordOut(BaseModel):
    id: int
    record_type: str
    host: str
    expected_value: Optional[str] = None
    found_value: Optional[str] = None
    status: str  # pending | valid | invalid | conflict
    cloudflare_record_id: Optional[str] = None
    last_checked_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DomainOut(BaseModel):
    id: int
    domain: str
    status: str                 # pending | partial | active | error
    spf_valid: bool
    dkim_valid: bool
    dmarc_valid: bool
    mx_valid: bool
    dkim_selector: str
    dkim_public_key: Optional[str] = None
    warmup_enabled: bool
    warmup_day: int
    warmup_daily_limit: int
    warmup_sent_today: int
    reputation_score: float
    bounce_rate: float
    complaint_rate: float
    inbox_placement: float
    is_default: bool
    cloudflare_zone_id: Optional[str] = None
    tracking_cname: Optional[str] = None
    bounce_subdomain: Optional[str] = None
    created_at: datetime
    verified_at: Optional[datetime] = None
    last_checked_at: Optional[datetime] = None
    dns_records: List[DnsRecordOut] = []

    model_config = {"from_attributes": True}

    # ── computed per-record status strings (derived from booleans + timestamps) ──

    @computed_field
    @property
    def spf_status(self) -> str:
        if self.spf_valid:
            return "verified"
        return "failed" if self.last_checked_at else "pending"

    @computed_field
    @property
    def dkim_status(self) -> str:
        if self.dkim_valid:
            return "verified"
        return "failed" if self.last_checked_at else "pending"

    @computed_field
    @property
    def dmarc_status(self) -> str:
        if self.dmarc_valid:
            return "verified"
        return "failed" if self.last_checked_at else "pending"

    @computed_field
    @property
    def mx_status(self) -> str:
        if self.mx_valid:
            return "verified"
        return "failed" if self.last_checked_at else "pending"


class VerifyResult(BaseModel):
    domain: str
    status: str                 # pending | partial | active
    spf_status: str             # pending | verified | failed
    dkim_status: str
    dmarc_status: str
    mx_status: str
    checks: dict                # raw checker output for debugging
    last_checked_at: datetime
    message: str


class DNSRecordsOut(BaseModel):
    domain: str
    selector: str
    records: dict               # keys: spf, dkim, dmarc, tracking, bounce


class WarmupProgress(BaseModel):
    domain_id: int
    domain: str
    warmup_enabled: bool
    current_day: int
    daily_limit: int
    sent_today: int
    schedule: list
    pct_complete: float


class SmtpLinkOut(BaseModel):
    id: int
    smtp_id: int
    smtp_name: str
    smtp_host: str
    is_primary: bool
    created_at: datetime

    model_config = {"from_attributes": True}
