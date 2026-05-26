from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class TemplateCreate(BaseModel):
    name: str
    subject: str
    html_content: str
    text_content: Optional[str] = None
    category: Optional[str] = "general"


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    html_content: Optional[str] = None
    text_content: Optional[str] = None
    category: Optional[str] = None


class TemplateOut(BaseModel):
    id: int
    name: str
    subject: str
    html_content: str
    text_content: Optional[str]
    category: Optional[str]
    is_default: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
