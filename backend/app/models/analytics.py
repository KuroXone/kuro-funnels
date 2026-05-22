from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Analytics(Base):
    __tablename__ = "analytics"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    sent = Column(Integer, default=0)
    delivered = Column(Integer, default=0)
    opens = Column(Integer, default=0)
    unique_opens = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    unique_clicks = Column(Integer, default=0)
    bounces = Column(Integer, default=0)
    complaints = Column(Integer, default=0)
    unsubscribes = Column(Integer, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    campaign = relationship("Campaign", back_populates="analytics")


class SendLog(Base):
    __tablename__ = "send_logs"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    smtp_id = Column(Integer, ForeignKey("smtps.id"), nullable=True)
    email = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, sent, failed, bounced
    error_message = Column(String, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    clicked_at = Column(DateTime(timezone=True), nullable=True)
    tracking_id = Column(String, unique=True, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("Campaign", back_populates="send_logs")


class EmailQueue(Base):
    __tablename__ = "email_queue"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    smtp_id = Column(Integer, ForeignKey("smtps.id"), nullable=True)
    status = Column(String, default="pending")  # pending, processing, sent, failed, retry
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(String, nullable=True)
    celery_task_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    campaign = relationship("Campaign", back_populates="queue_items")
    contact = relationship("Contact")
