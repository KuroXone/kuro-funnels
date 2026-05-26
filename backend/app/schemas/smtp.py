from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
from ..models.smtp import SMTPStatus


class SMTPCreate(BaseModel):
    name: str
    host: str
    port: int = 587
    username: str
    password: str
    secure: bool = True
    provider: Optional[str] = None
    limit_per_hour: int = 100
    limit_per_day: int = 1000
    weight: int = 1


class SMTPUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    secure: Optional[bool] = None
    provider: Optional[str] = None
    limit_per_hour: Optional[int] = None
    limit_per_day: Optional[int] = None
    weight: Optional[int] = None
    status: Optional[SMTPStatus] = None


class SMTPOut(BaseModel):
    id: int
    name: str
    host: str
    port: int
    username: str
    secure: bool
    provider: Optional[str]
    status: SMTPStatus
    limit_per_hour: int
    limit_per_day: int
    weight: int
    reputation_score: float
    last_tested_at: Optional[datetime]
    last_error: Optional[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SMTPTestResult(BaseModel):
    success: bool
    message: str
    latency_ms: Optional[int] = None
