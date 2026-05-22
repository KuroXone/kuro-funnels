from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    html_content = Column(Text, nullable=False)
    text_content = Column(Text, nullable=True)
    category = Column(String, nullable=True, default="general")
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    owner = relationship("User", backref="templates")
