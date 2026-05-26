import threading
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from ..database import get_db, SessionLocal
from ..models.domain import Domain, DnsRecord, SmtpDomainLink
from ..models.smtp import SMTPServer
from ..models.user import User
from ..schemas.domain import (
    DomainCreate, DomainUpdate, DomainOut, DNSRecordsOut,
    SmtpLinkOut, VerifyResult,
)
from ..auth.dependencies import get_current_user
from ..services.dns_checker import check_all
from ..services.domain_service import generate_dkim_keys, generate_dns_records, get_domain_health_status
from ..services import cloudflare_auto_service as cf_auto

router = APIRouter(prefix="/domains", tags=["domains"])


# ── shared verification logic (used by router + Celery task) ──────────────────

def run_dns_verification(db: Session, domain: Domain, now: datetime = None) -> dict:
    """
    Live-check SPF/DKIM/DMARC/MX, update domain + DnsRecord rows.
    Returns the raw check_all() result dict.
    """
    if now is None:
        now = datetime.now(timezone.utc)

    results = check_all(domain.domain, domain.dkim_selector)

    domain.spf_valid   = results["spf"]["valid"]
    domain.dkim_valid  = results["dkim"]["valid"]
    domain.dmarc_valid = results["dmarc"]["valid"]
    domain.mx_valid    = results["mx"]["valid"]
    domain.last_checked_at = now

    all_core = domain.spf_valid and domain.dkim_valid and domain.dmarc_valid
    if all_core:
        domain.status = "active"
        domain.verified_at = now
    elif domain.spf_valid or domain.dkim_valid or domain.dmarc_valid:
        domain.status = "partial"
    else:
        domain.status = "pending"

    # Sync per-record rows
    type_map = {
        "spf":   ("SPF",   domain.domain),
        "dkim":  ("DKIM",  f"{domain.dkim_selector}._domainkey.{domain.domain}"),
        "dmarc": ("DMARC", f"_dmarc.{domain.domain}"),
        "mx":    ("MX",    domain.domain),
    }
    for key, (rtype, host) in type_map.items():
        res   = results.get(key, {})
        valid = res.get("valid", False)
        found = res.get("record") or (", ".join(res.get("records", [])) if rtype == "MX" else None)
        row   = db.query(DnsRecord).filter_by(domain_id=domain.id, record_type=rtype).first()
        if row:
            row.status         = "valid" if valid else "invalid"
            row.found_value    = found
            row.last_checked_at = now
        else:
            db.add(DnsRecord(
                domain_id=domain.id, record_type=rtype, host=host,
                found_value=found, status="valid" if valid else "invalid",
                last_checked_at=now,
            ))

    return results


# ── Cloudflare background provisioning ───────────────────────────────────────

def _provision_in_background(domain_id: int):
    """Fire-and-forget thread: push DNS records to Cloudflare, then update DB."""
    db = SessionLocal()
    try:
        domain = db.query(Domain).filter(Domain.id == domain_id).first()
        if not domain:
            return

        result = cf_auto.apply_all_records(
            domain.domain,
            domain.dkim_selector,
            domain.dkim_public_key or "",
            domain.tracking_cname,
        )

        if result.get("error") or not result.get("zone_id"):
            return

        now = datetime.now(timezone.utc)
        domain.cloudflare_zone_id = result["zone_id"]
        domain.last_checked_at = now

        for rec in result.get("records", []):
            if rec["status"] == "applied":
                row = db.query(DnsRecord).filter_by(
                    domain_id=domain.id, record_type=rec["record_type"]
                ).first()
                if row:
                    row.cloudflare_record_id = rec.get("cf_id")
                    row.status = "valid"
                    row.last_checked_at = now

        applied = sum(1 for r in result.get("records", []) if r["status"] == "applied")
        if applied >= 3:
            domain.spf_valid  = True
            domain.dkim_valid = True
            domain.dmarc_valid = True
            domain.status     = "active"
            domain.verified_at = now

        db.commit()
    except Exception:
        pass
    finally:
        db.close()


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/", response_model=List[DomainOut])
def list_domains(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(Domain)
        .filter(Domain.owner_id == current_user.id)
        .order_by(Domain.created_at.desc())
        .all()
    )


@router.post("/", response_model=DomainOut, status_code=201)
def add_domain(
    payload: DomainCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(Domain).filter(
        Domain.owner_id == current_user.id,
        Domain.domain == payload.domain,
    ).first():
        raise HTTPException(status_code=409, detail="Domain already added")

    private_key, public_key = generate_dkim_keys()
    has_default = db.query(Domain).filter(
        Domain.owner_id == current_user.id, Domain.is_default == True
    ).first()

    domain = Domain(
        owner_id         = current_user.id,
        domain           = payload.domain,
        dkim_selector    = payload.dkim_selector,
        dkim_private_key = private_key,
        dkim_public_key  = public_key,
        is_default       = not has_default,
        tracking_cname   = f"track.{payload.domain}",
        bounce_subdomain = f"bounce.{payload.domain}",
    )
    db.add(domain)
    db.commit()
    db.refresh(domain)

    # Generate expected DNS values so they're ready for display immediately
    rec_defs = generate_dns_records(
        payload.domain, payload.dkim_selector, public_key,
        tracking_subdomain=f"track.{payload.domain}",
        bounce_subdomain=f"bounce.{payload.domain}",
    )
    expected_map = {
        "SPF":      rec_defs["spf"]["value"],
        "DKIM":     rec_defs["dkim"]["value"],
        "DMARC":    rec_defs["dmarc"]["value"],
        "TRACKING": rec_defs["tracking"]["value"],
        "BOUNCE":   rec_defs["bounce"]["value"],
    }
    host_map = {
        "SPF":      rec_defs["spf"]["host"],
        "DKIM":     rec_defs["dkim"]["host"],
        "DMARC":    rec_defs["dmarc"]["host"],
        "TRACKING": rec_defs["tracking"]["host"],
        "BOUNCE":   rec_defs["bounce"]["host"],
        "MX":       payload.domain,
    }

    for rtype, host in host_map.items():
        db.add(DnsRecord(
            domain_id      = domain.id,
            record_type    = rtype,
            host           = host,
            expected_value = expected_map.get(rtype),
            status         = "pending",
        ))
    db.commit()
    db.refresh(domain)

    # Auto-provision DNS via Cloudflare if token is configured
    if cf_auto.is_configured():
        threading.Thread(target=_provision_in_background, args=(domain.id,), daemon=True).start()

    return domain


@router.post("/{domain_id}/verify", response_model=VerifyResult)
def verify_domain(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Live DNS check for a domain.
    Updates status fields and per-record rows in the database.
    """
    domain = db.query(Domain).filter(
        Domain.id == domain_id, Domain.owner_id == current_user.id
    ).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    now     = datetime.now(timezone.utc)
    results = run_dns_verification(db, domain, now)
    db.commit()
    db.refresh(domain)

    def _status(valid: bool) -> str:
        return "verified" if valid else "failed"

    if domain.status == "active":
        msg = "All DNS records verified — domain is fully active."
    elif domain.status == "partial":
        msg = "Some DNS records verified — check remaining records."
    else:
        msg = "DNS records not yet detected — propagation can take up to 48h."

    return VerifyResult(
        domain         = domain.domain,
        status         = domain.status,
        spf_status     = _status(domain.spf_valid),
        dkim_status    = _status(domain.dkim_valid),
        dmarc_status   = _status(domain.dmarc_valid),
        mx_status      = _status(domain.mx_valid),
        checks         = results,
        last_checked_at = now,
        message        = msg,
    )


@router.post("/{domain_id}/provision")
def provision_domain(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retry automatic Cloudflare DNS provisioning (fire-and-forget)."""
    domain = db.query(Domain).filter(
        Domain.id == domain_id, Domain.owner_id == current_user.id
    ).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    if not cf_auto.is_configured():
        raise HTTPException(
            status_code=501,
            detail="CLOUDFLARE_API_TOKEN is not configured. Set it in backend/.env.",
        )

    threading.Thread(target=_provision_in_background, args=(domain.id,), daemon=True).start()
    return {"queued": True, "message": "Cloudflare DNS provisioning started. Refresh in a few seconds."}


@router.get("/{domain_id}", response_model=DomainOut)
def get_domain(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    return domain


@router.patch("/{domain_id}", response_model=DomainOut)
def update_domain(
    domain_id: int,
    payload: DomainUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(domain, field, value)
    db.commit()
    db.refresh(domain)
    return domain


@router.delete("/{domain_id}", status_code=204)
def delete_domain(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    was_default = domain.is_default
    db.delete(domain)
    db.commit()

    if was_default:
        nxt = db.query(Domain).filter(Domain.owner_id == current_user.id).first()
        if nxt:
            nxt.is_default = True
            db.commit()


@router.post("/{domain_id}/set-default", response_model=DomainOut)
def set_default_domain(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    db.query(Domain).filter(Domain.owner_id == current_user.id).update({"is_default": False})
    domain.is_default = True
    db.commit()
    db.refresh(domain)
    return domain


@router.get("/{domain_id}/dns-records")
def get_dns_records(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the DNS records that should be created for this domain."""
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    records = generate_dns_records(
        domain.domain,
        domain.dkim_selector,
        domain.dkim_public_key or "PUBLIC_KEY_NOT_GENERATED",
        tracking_subdomain=domain.tracking_cname,
        bounce_subdomain=domain.bounce_subdomain,
    )
    return {"domain": domain.domain, "selector": domain.dkim_selector, "records": records}


@router.get("/{domain_id}/records")
def get_record_statuses(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return per-record verification status rows (fast, no live DNS query)."""
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    rows = db.query(DnsRecord).filter(DnsRecord.domain_id == domain_id).all()
    return [
        {
            "id":                   r.id,
            "record_type":          r.record_type,
            "host":                 r.host,
            "expected_value":       r.expected_value,
            "found_value":          r.found_value,
            "status":               r.status,
            "cloudflare_record_id": r.cloudflare_record_id,
            "last_checked_at":      r.last_checked_at,
        }
        for r in rows
    ]


@router.post("/{domain_id}/regenerate-dkim")
def regenerate_dkim(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    private_key, public_key = generate_dkim_keys()
    domain.dkim_private_key = private_key
    domain.dkim_public_key  = public_key
    domain.dkim_valid       = False
    domain.status           = "pending"

    # Update expected DKIM value in DnsRecord
    dkim_row = db.query(DnsRecord).filter_by(domain_id=domain.id, record_type="DKIM").first()
    if dkim_row:
        rec_defs = generate_dns_records(domain.domain, domain.dkim_selector, public_key)
        dkim_row.expected_value      = rec_defs["dkim"]["value"]
        dkim_row.status              = "pending"
        dkim_row.cloudflare_record_id = None

    db.commit()

    # Re-provision automatically if CF is configured
    if cf_auto.is_configured():
        threading.Thread(target=_provision_in_background, args=(domain.id,), daemon=True).start()

    return {
        "message":    "DKIM keys regenerated — DNS records are being re-applied.",
        "public_key": public_key,
    }


@router.get("/{domain_id}/smtp-links")
def list_smtp_links(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    links = db.query(SmtpDomainLink).filter(SmtpDomainLink.domain_id == domain_id).all()
    return [
        {
            "id":         lnk.id,
            "smtp_id":    lnk.smtp_id,
            "smtp_name":  lnk.smtp.name if lnk.smtp else None,
            "smtp_host":  lnk.smtp.host if lnk.smtp else None,
            "is_primary": lnk.is_primary,
            "created_at": lnk.created_at,
        }
        for lnk in links
    ]


@router.post("/{domain_id}/smtp-links", status_code=201)
def add_smtp_link(
    domain_id: int,
    smtp_id: int,
    is_primary: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    smtp = db.query(SMTPServer).filter(SMTPServer.id == smtp_id, SMTPServer.owner_id == current_user.id).first()
    if not smtp:
        raise HTTPException(status_code=404, detail="SMTP server not found")

    if db.query(SmtpDomainLink).filter_by(domain_id=domain_id, smtp_id=smtp_id).first():
        raise HTTPException(status_code=409, detail="SMTP already linked to this domain")

    if is_primary:
        db.query(SmtpDomainLink).filter_by(domain_id=domain_id).update({"is_primary": False})

    db.add(SmtpDomainLink(domain_id=domain_id, smtp_id=smtp_id, is_primary=is_primary))
    db.commit()
    return {"message": "SMTP linked"}


@router.delete("/{domain_id}/smtp-links/{smtp_id}", status_code=204)
def remove_smtp_link(
    domain_id: int,
    smtp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    link = db.query(SmtpDomainLink).filter_by(domain_id=domain_id, smtp_id=smtp_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    db.delete(link)
    db.commit()
