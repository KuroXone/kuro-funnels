from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from ..database import get_db
from ..models.domain import Domain, CloudflareConnection, DnsRecord
from ..models.user import User
from ..schemas.cloudflare import CloudflareConnectRequest, CloudflareConnectionOut, CloudflareZone, CloudflareApplyResult
from ..auth.dependencies import get_current_user
from ..config import settings
from ..services import cloudflare_service as cf
from ..services.domain_service import generate_dns_records

router = APIRouter(prefix="/cloudflare", tags=["cloudflare"])


@router.post("/connect", response_model=CloudflareConnectionOut, status_code=201)
def connect_cloudflare(
    payload: CloudflareConnectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a Cloudflare API token (encrypted), verify it, and optionally pin a zone."""
    result = cf.verify_token(payload.token)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=f"Token invalid: {result.get('error', 'Unknown error')}")

    # Fetch user info so we can display a friendly account name
    user_info = cf.get_user_info(payload.token)
    account_name = user_info.get("email") or payload.name

    zone_name = None
    if payload.zone_id:
        zones = cf.list_zones(payload.token)
        zone = next((z for z in zones if z["id"] == payload.zone_id), None)
        zone_name = zone["name"] if zone else None

    encrypted = cf.encrypt_token(payload.token, settings.SECRET_KEY)
    conn = CloudflareConnection(
        owner_id=current_user.id,
        name=payload.name,
        connection_type="api_token",
        account_name=account_name,
        encrypted_token=encrypted,
        zone_id=payload.zone_id,
        zone_name=zone_name,
        verified=True,
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return conn


@router.get("/", response_model=List[CloudflareConnectionOut])
def list_connections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(CloudflareConnection).filter(CloudflareConnection.owner_id == current_user.id).all()


@router.delete("/{conn_id}", status_code=204)
def delete_connection(
    conn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = db.query(CloudflareConnection).filter(
        CloudflareConnection.id == conn_id, CloudflareConnection.owner_id == current_user.id
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    db.delete(conn)
    db.commit()


@router.get("/zones")
def list_all_zones(
    conn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List Cloudflare zones accessible by a saved connection."""
    conn = db.query(CloudflareConnection).filter(
        CloudflareConnection.id == conn_id, CloudflareConnection.owner_id == current_user.id
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    token = cf.decrypt_token(conn.encrypted_token, settings.SECRET_KEY)
    zones = cf.list_zones(token)
    return zones


@router.post("/domains/{domain_id}/apply")
def apply_dns_via_cloudflare(
    domain_id: int,
    conn_id: int,
    zone_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Auto-create all DNS records for a domain via Cloudflare API.
    Creates/updates SPF, DKIM, DMARC, Tracking CNAME.
    Pass zone_id to target a specific zone, otherwise auto-detects from domain name.
    """
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    conn = db.query(CloudflareConnection).filter(
        CloudflareConnection.id == conn_id, CloudflareConnection.owner_id == current_user.id
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Cloudflare connection not found")

    token = cf.decrypt_token(conn.encrypted_token, settings.SECRET_KEY)

    # Determine zone — use passed zone_id, then pinned zone, then auto-detect
    effective_zone_id = zone_id or conn.zone_id
    if not effective_zone_id:
        zone = cf.get_zone_by_domain(token, domain.domain)
        if not zone:
            raise HTTPException(status_code=400, detail=f"No Cloudflare zone found for {domain.domain}. Select a zone manually.")
        effective_zone_id = zone["id"]

    # Generate record values
    records_def = generate_dns_records(
        domain.domain,
        domain.dkim_selector,
        domain.dkim_public_key or "",
        tracking_subdomain=domain.tracking_cname,
        bounce_subdomain=domain.bounce_subdomain,
    )

    applied = 0
    failed = 0
    results = []

    cf_type_map = {
        "spf":      ("TXT",   records_def["spf"]["host"],      records_def["spf"]["value"]),
        "dkim":     ("TXT",   records_def["dkim"]["host"],     records_def["dkim"]["value"]),
        "dmarc":    ("TXT",   records_def["dmarc"]["host"],    records_def["dmarc"]["value"]),
        "tracking": ("CNAME", records_def["tracking"]["host"], records_def["tracking"]["value"]),
    }

    db_rtype_map = {"spf": "SPF", "dkim": "DKIM", "dmarc": "DMARC", "tracking": "TRACKING"}

    for key, (rtype, name, content) in cf_type_map.items():
        cf_record_id = cf.upsert_dns_record(token, effective_zone_id, rtype, name, content)
        db_rtype = db_rtype_map[key]
        row = db.query(DnsRecord).filter_by(domain_id=domain.id, record_type=db_rtype).first()
        if cf_record_id:
            applied += 1
            results.append({"record_type": db_rtype, "status": "applied", "cf_id": cf_record_id})
            if row:
                row.cloudflare_record_id = cf_record_id
                row.expected_value = content
                row.status = "pending"  # verified on next check-dns
        else:
            failed += 1
            results.append({"record_type": db_rtype, "status": "failed"})

    # Save the zone on the domain for reference
    domain.cloudflare_zone_id = effective_zone_id
    db.commit()

    return {"domain": domain.domain, "applied": applied, "failed": failed, "records": results}


@router.post("/domains/{domain_id}/remove")
def remove_dns_via_cloudflare(
    domain_id: int,
    conn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove all CF-managed DNS records for a domain."""
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    conn = db.query(CloudflareConnection).filter(
        CloudflareConnection.id == conn_id, CloudflareConnection.owner_id == current_user.id
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Cloudflare connection not found")

    token = cf.decrypt_token(conn.encrypted_token, settings.SECRET_KEY)
    zone_id = domain.cloudflare_zone_id or conn.zone_id
    if not zone_id:
        raise HTTPException(status_code=400, detail="No Cloudflare zone associated with this domain")

    rows = db.query(DnsRecord).filter(
        DnsRecord.domain_id == domain_id,
        DnsRecord.cloudflare_record_id.isnot(None),
    ).all()

    removed = 0
    for row in rows:
        if cf.delete_dns_record(token, zone_id, row.cloudflare_record_id):
            row.cloudflare_record_id = None
            row.status = "pending"
            removed += 1

    db.commit()
    return {"removed": removed}
