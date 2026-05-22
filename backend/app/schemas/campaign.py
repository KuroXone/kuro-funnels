from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from ..models.campaign import CampaignStatus


class CampaignCreate(BaseModel):
    name: str
    subject: str
    from_name: str
    from_email: EmailStr
    reply_to: Optional[str] = None
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    contact_list_id: Optional[int] = None
    scheduled_at: Optional[datetime] = None
    track_opens: bool = True
    track_clicks: bool = True


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    from_name: Optional[str] = None
    from_email: Optional[EmailStr] = None
    reply_to: Optional[str] = None
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    contact_list_id: Optional[int] = None
    scheduled_at: Optional[datetime] = None


class CampaignOut(BaseModel):
    id: int
    name: str
    subject: str
    from_name: str
    from_email: str
    status: CampaignStatus
    contact_list_id: Optional[int]
    scheduled_at: Optional[datetime]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    total_recipients: int
    track_opens: bool
    track_clicks: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TestEmailRequest(BaseModel):
    to_email: EmailStr
    smtp_id: Optional[int] = None
