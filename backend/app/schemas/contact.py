from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class ContactListCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ContactListOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    contact_count: int = 0

    class Config:
        from_attributes = True


class ContactCreate(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None


class ContactOut(BaseModel):
    id: int
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    is_subscribed: bool
    is_bounced: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ContactImportResult(BaseModel):
    imported: int
    skipped: int
    errors: int
    total: int
