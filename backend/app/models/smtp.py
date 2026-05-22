from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base


class SMTPStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    error = "error"
    testing = "testing"


class SMTPServer(Base):
    __tablename__ = "smtps"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    host = Column(String, nullable=False)
    port = Column(Integer, default=587)
    username = Column(String, nullable=False)
    password = Column(String, nullable=False)
    secure = Column(Boolean, default=True)
    provider = Column(String, nullable=True)
    status = Column(SAEnum(SMTPStatus), default=SMTPStatus.active)
    limit_per_hour = Column(Integer, default=100)
    limit_per_day = Column(Integer, default=1000)
    weight = Column(Integer, default=1)
    reputation_score = Column(Float, default=100.0)
    last_tested_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(String, nullable=True)
    cooldown_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", back_populates="smtp_servers")
    stats = relationship("SMTPStats", back_populates="smtp", lazy="dynamic")


class SMTPStats(Base):
    __tablename__ = "smtp_stats"

    id = Column(Integer, primary_key=True, index=True)
    smtp_id = Column(Integer, ForeignKey("smtps.id"), nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now())
    sent_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    bounced_count = Column(Integer, default=0)
    hour_bucket = Column(Integer, nullable=True)

    smtp = relationship("SMTPServer", back_populates="stats")
