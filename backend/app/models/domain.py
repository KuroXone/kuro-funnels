from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Domain(Base):
    __tablename__ = "domains"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    domain = Column(String, nullable=False, index=True)
    status = Column(String, default="pending")  # pending, partial, active, error, suspended

    # DNS validation (aggregate booleans — detailed per-record in DnsRecord table)
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

    # Extended features
    is_default = Column(Boolean, default=False)
    cloudflare_zone_id = Column(String, nullable=True)
    tracking_cname = Column(String, nullable=True)   # e.g. track.yourdomain.com
    bounce_subdomain = Column(String, nullable=True)  # e.g. bounce.yourdomain.com

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    verified_at = Column(DateTime(timezone=True), nullable=True)
    last_checked_at = Column(DateTime(timezone=True), nullable=True)

    owner = relationship("User", back_populates="domains")
    dns_records = relationship("DnsRecord", back_populates="domain", cascade="all, delete-orphan")
    smtp_links = relationship("SmtpDomainLink", back_populates="domain", cascade="all, delete-orphan")


class CloudflareConnection(Base):
    __tablename__ = "cloudflare_connections"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)

    # Legacy manual token (kept for backwards compat)
    encrypted_token = Column(Text, nullable=True)

    # OAuth 2.0 tokens
    connection_type = Column(String, default="api_token")  # "api_token" | "oauth"
    encrypted_access_token = Column(Text, nullable=True)
    encrypted_refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Cloudflare account info (populated after OAuth)
    account_id = Column(String, nullable=True)
    account_name = Column(String, nullable=True)

    zone_id = Column(String, nullable=True)
    zone_name = Column(String, nullable=True)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User")


class CloudflareOAuthState(Base):
    """Temporary CSRF state tokens for OAuth flow."""
    __tablename__ = "cloudflare_oauth_states"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String, unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)

    user = relationship("User")


class DnsRecord(Base):
    __tablename__ = "dns_records"

    id = Column(Integer, primary_key=True, index=True)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    record_type = Column(String, nullable=False)  # SPF, DKIM, DMARC, MX, TRACKING, BOUNCE
    host = Column(String, nullable=False)
    expected_value = Column(Text, nullable=True)
    found_value = Column(Text, nullable=True)
    status = Column(String, default="pending")  # pending, valid, invalid, conflict
    cloudflare_record_id = Column(String, nullable=True)  # CF record ID if auto-created
    last_checked_at = Column(DateTime(timezone=True), nullable=True)

    domain = relationship("Domain", back_populates="dns_records")

    __table_args__ = (UniqueConstraint("domain_id", "record_type", name="uq_domain_record_type"),)


class SmtpDomainLink(Base):
    __tablename__ = "smtp_domain_links"

    id = Column(Integer, primary_key=True, index=True)
    domain_id = Column(Integer, ForeignKey("domains.id"), nullable=False)
    smtp_id = Column(Integer, ForeignKey("smtps.id"), nullable=False)
    is_primary = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    domain = relationship("Domain", back_populates="smtp_links")
    smtp = relationship("SMTPServer")

    __table_args__ = (UniqueConstraint("domain_id", "smtp_id", name="uq_domain_smtp"),)


class AppSettings(Base):
    """Key-value store for runtime settings (e.g. Cloudflare OAuth credentials)."""
    __tablename__ = "app_settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)
    encrypted = Column(Boolean, default=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
