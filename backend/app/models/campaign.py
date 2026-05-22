from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base


class CampaignStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    sending = "sending"
    paused = "paused"
    completed = "completed"
    failed = "failed"


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    from_name = Column(String, nullable=False)
    from_email = Column(String, nullable=False)
    reply_to = Column(String, nullable=True)
    html_content = Column(Text, nullable=True)
    text_content = Column(Text, nullable=True)
    status = Column(SAEnum(CampaignStatus), default=CampaignStatus.draft)
    contact_list_id = Column(Integer, ForeignKey("contact_lists.id"), nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    track_opens = Column(Boolean, default=True)
    track_clicks = Column(Boolean, default=True)
    total_recipients = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="campaigns")
    contact_list = relationship("ContactList", back_populates="campaigns")
    queue_items = relationship("EmailQueue", back_populates="campaign", lazy="dynamic")
    analytics = relationship("Analytics", back_populates="campaign", uselist=False)
    send_logs = relationship("SendLog", back_populates="campaign", lazy="dynamic")
