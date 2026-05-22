from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Domain(Base):
    __tablename__ = "domains"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    domain = Column(String, nullable=False, index=True)
    status = Column(String, default="pending")  # pending, active, error, suspended

    # DNS validation
    spf_valid = Column(Boolean, default=False)
    dkim_valid = Column(Boolean, default=False)
    dmarc_valid = Column(Boolean, default=False)
    mx_valid = Column(Boolean, default=False)

    # DKIM keys
    dkim_selector = Column(String, default="kuro")
    dkim_private_key = Column(Text, nullable=True)
    dkim_public_key = Column(Text, nullable=True)

    # Warmup
    warmup_enabled = Column(Boolean, default=False)
    warmup_day = Column(Integer, default=0)
    warmup_daily_limit = Column(Integer, default=20)
    warmup_sent_today = Column(Integer, default=0)
    warmup_last_advanced = Column(DateTime(timezone=True), nullable=True)

    # Health metrics
    reputation_score = Column(Float, default=100.0)
    bounce_rate = Column(Float, default=0.0)
    complaint_rate = Column(Float, default=0.0)
    inbox_placement = Column(Float, default=100.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    verified_at = Column(DateTime(timezone=True), nullable=True)
    last_checked_at = Column(DateTime(timezone=True), nullable=True)

    owner = relationship("User", back_populates="domains")
