from pydantic import BaseModel, field_validator
from typing import Optional
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


class DNSCheckResult(BaseModel):
    record_type: str
    host: str
    expected: str
    found: Optional[str] = None
    valid: bool
    message: str


class DNSRecordsOut(BaseModel):
    spf: dict
    dkim: dict
    dmarc: dict
    mx: Optional[dict] = None


class DomainOut(BaseModel):
    id: int
    domain: str
    status: str
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
    created_at: datetime
    verified_at: Optional[datetime] = None
    last_checked_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class WarmupProgress(BaseModel):
    domain_id: int
    domain: str
    warmup_enabled: bool
    current_day: int
    daily_limit: int
    sent_today: int
    schedule: list
    pct_complete: float
