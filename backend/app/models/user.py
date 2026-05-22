from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role = Column(SAEnum(UserRole), default=UserRole.user)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    campaigns = relationship("Campaign", back_populates="owner", lazy="dynamic")
    smtp_servers = relationship("SMTPServer", back_populates="owner", lazy="dynamic")
    contact_lists = relationship("ContactList", back_populates="owner", lazy="dynamic")
    domains = relationship("Domain", back_populates="owner", lazy="dynamic")
