from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base

contact_tags = Table(
    "contact_tags",
    Base.metadata,
    Column("contact_id", Integer, ForeignKey("contacts.id")),
    Column("tag_id", Integer, ForeignKey("tags.id")),
)


class ContactList(Base):
    __tablename__ = "contact_lists"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="contact_lists")
    contacts = relationship("Contact", back_populates="contact_list", lazy="dynamic")
    campaigns = relationship("Campaign", back_populates="contact_list", lazy="dynamic")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    contact_list_id = Column(Integer, ForeignKey("contact_lists.id"), nullable=False)
    email = Column(String, nullable=False, index=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    custom_fields = Column(Text, nullable=True)  # JSON
    is_subscribed = Column(Boolean, default=True)
    is_bounced = Column(Boolean, default=False)
    is_complained = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contact_list = relationship("ContactList", back_populates="contacts")
    tags = relationship("Tag", secondary=contact_tags, back_populates="contacts")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    contacts = relationship("Contact", secondary=contact_tags, back_populates="tags")


class Unsubscribe(Base):
    __tablename__ = "unsubscribes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, nullable=False, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=True)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
