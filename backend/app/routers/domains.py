from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from ..database import get_db
from ..models.domain import Domain
from ..models.user import User
from ..schemas.domain import DomainCreate, DomainUpdate, DomainOut, DNSRecordsOut
from ..auth.dependencies import get_current_user
from ..services.dns_checker import check_all
from ..services.domain_service import generate_dkim_keys, generate_dns_records, get_domain_health_status

router = APIRouter(prefix="/domains", tags=["domains"])


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
    exists = db.query(Domain).filter(
        Domain.owner_id == current_user.id,
        Domain.domain == payload.domain,
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="Domain already added")

    private_key, public_key = generate_dkim_keys()
    domain = Domain(
        owner_id=current_user.id,
        domain=payload.domain,
        dkim_selector=payload.dkim_selector,
        dkim_private_key=private_key,
        dkim_public_key=public_key,
    )
    db.add(domain)
    db.commit()
    db.refresh(domain)
    return domain


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
    db.delete(domain)
    db.commit()


@router.post("/{domain_id}/check-dns")
def check_dns(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run live DNS checks and update the domain's validation status."""
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    results = check_all(domain.domain, domain.dkim_selector)

    domain.spf_valid = results["spf"]["valid"]
    domain.dkim_valid = results["dkim"]["valid"]
    domain.dmarc_valid = results["dmarc"]["valid"]
    domain.mx_valid = results["mx"]["valid"]
    domain.last_checked_at = datetime.now(timezone.utc)

    all_valid = domain.spf_valid and domain.dkim_valid and domain.dmarc_valid
    if all_valid:
        domain.status = "active"
        domain.verified_at = datetime.now(timezone.utc)
    elif domain.spf_valid or domain.dkim_valid or domain.dmarc_valid:
        domain.status = "partial"
    else:
        domain.status = "pending"

    db.commit()
    db.refresh(domain)

    return {
        "domain": domain.domain,
        "status": domain.status,
        "checks": results,
        "spf_valid": domain.spf_valid,
        "dkim_valid": domain.dkim_valid,
        "dmarc_valid": domain.dmarc_valid,
        "mx_valid": domain.mx_valid,
    }


@router.get("/{domain_id}/dns-records")
def get_dns_records(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the DNS records the user needs to configure."""
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    records = generate_dns_records(
        domain.domain,
        domain.dkim_selector,
        domain.dkim_public_key or "PUBLIC_KEY_NOT_GENERATED",
    )
    return {
        "domain": domain.domain,
        "selector": domain.dkim_selector,
        "records": records,
    }


@router.post("/{domain_id}/regenerate-dkim")
def regenerate_dkim(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a new DKIM key pair for the domain."""
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    private_key, public_key = generate_dkim_keys()
    domain.dkim_private_key = private_key
    domain.dkim_public_key = public_key
    domain.dkim_valid = False
    domain.status = "pending"
    db.commit()
    return {"message": "DKIM keys regenerated. Update your DNS record.", "public_key": public_key}
