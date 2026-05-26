from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CloudflareConnectRequest(BaseModel):
    name: str
    token: str
    zone_id: Optional[str] = None


class CloudflareConnectionOut(BaseModel):
    id: int
    name: str
    connection_type: str = "api_token"
    account_name: Optional[str] = None
    zone_id: Optional[str] = None
    zone_name: Optional[str] = None
    verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CloudflareZone(BaseModel):
    id: str
    name: str
    status: str
    plan: str = "Free"


class CloudflareApplyResult(BaseModel):
    domain: str
    applied: int
    failed: int
    records: List[dict]
