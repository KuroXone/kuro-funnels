"""
Cloudflare OAuth 2.0 router.

Credentials are resolved from DB first (set via POST /cloudflare/oauth/setup),
then fall back to .env values — so no restart is needed after entering credentials
through the UI.

Endpoints:
  POST /cloudflare/oauth/setup        → save Client ID + Secret to DB (no restart needed)
  GET  /cloudflare/oauth/config       → is OAuth configured? (checks DB + .env)
  GET  /cloudflare/oauth/authorize    → returns Cloudflare auth URL + CSRF state
  POST /cloudflare/oauth/callback     → exchanges code for token, saves connection
  GET  /cloudflare/oauth/status       → returns current connection status
  GET  /cloudflare/oauth/zones        → lists Cloudflare zones (auto-refreshes token)
  POST /cloudflare/oauth/apply/{id}   → auto-creates all DNS records for a domain
  DELETE /cloudflare/oauth/disconnect → revokes token + removes connection
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from typing import Optional

from ..database import get_db
from ..models.domain import Domain, CloudflareConnection, CloudflareOAuthState, DnsRecord
from ..models.user import User
from ..auth.dependencies import get_current_user
from ..config import settings
from ..services import cloudflare_oauth_service as cf
from ..services.settings_service import get_setting, set_setting
from ..services.domain_service import generate_dns_records

router = APIRouter(prefix="/cloudflare/oauth", tags=["cloudflare-oauth"])


def _get_credentials(db: Session) -> tuple[str, str]:
    """Return (client_id, client_secret) from DB then .env."""
    cid     = get_setting(db, "CF_CLIENT_ID")     or settings.CF_CLIENT_ID
    csecret = get_setting(db, "CF_CLIENT_SECRET") or settings.CF_CLIENT_SECRET
    return cid, csecret


def _require_configured(db: Session):
    cid, csecret = _get_credentials(db)
    if not cid or not csecret:
        raise HTTPException(
            status_code=501,
            detail=(
                "Cloudflare OAuth is not configured. "
                "Go to Domain Manager → Connect Cloudflare and enter your Client ID and Secret."
            ),
        )


# ─── 0. Save credentials (no restart needed) ─────────────────────────────────

@router.post("/setup")
def setup_oauth(
    client_id: str,
    client_secret: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Save Cloudflare OAuth credentials to the database.
    Takes effect immediately — no server restart required.
    """
    client_id     = client_id.strip()
    client_secret = client_secret.strip()
    if not client_id or not client_secret:
        raise HTTPException(status_code=400, detail="Both client_id and client_secret are required")

    set_setting(db, "CF_CLIENT_ID",     client_id,     encrypted=False)
    set_setting(db, "CF_CLIENT_SECRET", client_secret, encrypted=True)

    return {
        "success":    True,
        "configured": True,
        "message":    "Cloudflare OAuth credentials saved. The 'Sign in with Cloudflare' button is now active.",
    }


# ─── 0b. Config check ────────────────────────────────────────────────────────

@router.get("/config")
def get_oauth_config(db: Session = Depends(get_db)):
    """Returns whether OAuth is configured (checks DB first, then .env)."""
    cid, csecret = _get_credentials(db)
    return {
        "configured":   bool(cid and csecret),
        "redirect_uri": settings.CF_REDIRECT_URI,
    }


# ─── 1. Start OAuth ──────────────────────────────────────────────────────────

@router.get("/authorize")
def authorize(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a Cloudflare OAuth authorization URL.
    Frontend redirects the user to this URL.
    """
    _require_configured(db)

    state      = cf.generate_state()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)

    # Clean up stale states for this user
    db.query(CloudflareOAuthState).filter(
        CloudflareOAuthState.user_id  == current_user.id,
        CloudflareOAuthState.expires_at < datetime.now(timezone.utc),
    ).delete()

    db.add(CloudflareOAuthState(
        state      = state,
        user_id    = current_user.id,
        expires_at = expires_at,
    ))
    db.commit()

    auth_url = cf.build_authorize_url(state, db=db)
    return {"url": auth_url, "state": state}


# ─── 2. OAuth Callback ────────────────────────────────────────────────────────

@router.post("/callback")
def oauth_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Exchange authorization code for tokens.
    Called by the frontend after Cloudflare redirects back.
    """
    _require_configured(db)

    # Validate CSRF state
    state_row = db.query(CloudflareOAuthState).filter(
        CloudflareOAuthState.state   == state,
        CloudflareOAuthState.user_id == current_user.id,
    ).first()
    if not state_row:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state. Please try connecting again.")
    if state_row.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        db.delete(state_row)
        db.commit()
        raise HTTPException(status_code=400, detail="OAuth state expired. Please try connecting again.")

    db.delete(state_row)
    db.commit()

    # Exchange code → tokens
    try:
        token_data = cf.exchange_code(code, db=db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to connect to Cloudflare: {str(e)}")

    access_token  = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in    = token_data.get("expires_in", 3600)

    if not access_token:
        raise HTTPException(status_code=400, detail="Cloudflare did not return an access token.")

    # Fetch Cloudflare account info
    account     = cf.get_account_info(access_token)
    account_id  = account["id"]   if account else None
    account_name = account["name"] if account else "Cloudflare Account"

    now        = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=expires_in)

    # Update existing connection or create new one
    existing = (
        db.query(CloudflareConnection)
        .filter(
            CloudflareConnection.owner_id       == current_user.id,
            CloudflareConnection.connection_type == "oauth",
            CloudflareConnection.account_id      == account_id,
        )
        .first()
    ) if account_id else None

    if existing:
        existing.encrypted_access_token  = cf.encrypt(access_token)
        existing.encrypted_refresh_token = cf.encrypt(refresh_token) if refresh_token else existing.encrypted_refresh_token
        existing.token_expires_at        = expires_at
        existing.verified                = True
        existing.name                    = account_name
        existing.account_name            = account_name
        db.commit()
        db.refresh(existing)
        conn = existing
    else:
        conn = CloudflareConnection(
            owner_id                = current_user.id,
            name                    = account_name,
            connection_type         = "oauth",
            encrypted_token         = None,
            encrypted_access_token  = cf.encrypt(access_token),
            encrypted_refresh_token = cf.encrypt(refresh_token) if refresh_token else None,
            token_expires_at        = expires_at,
            account_id              = account_id,
            account_name            = account_name,
            verified                = True,
        )
        db.add(conn)
        db.commit()
        db.refresh(conn)

    return {
        "success":        True,
        "connection_id":  conn.id,
        "account_name":   conn.account_name,
        "message":        f"Connected to Cloudflare: {conn.account_name}",
    }


# ─── 3. Status ────────────────────────────────────────────────────────────────

@router.get("/status")
def oauth_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conns = (
        db.query(CloudflareConnection)
        .filter(
            CloudflareConnection.owner_id       == current_user.id,
            CloudflareConnection.connection_type == "oauth",
            CloudflareConnection.verified        == True,
        )
        .all()
    )
    if not conns:
        return {"connected": False, "connections": []}
    return {
        "connected": True,
        "connections": [
            {
                "id":              c.id,
                "name":            c.name,
                "account_id":      c.account_id,
                "account_name":    c.account_name,
                "zone_id":         c.zone_id,
                "zone_name":       c.zone_name,
                "token_expires_at": c.token_expires_at,
            }
            for c in conns
        ],
    }


# ─── 4. Zones ────────────────────────────────────────────────────────────────

@router.get("/zones")
def list_zones(
    connection_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all Cloudflare zones accessible by the connected account."""
    query = db.query(CloudflareConnection).filter(
        CloudflareConnection.owner_id       == current_user.id,
        CloudflareConnection.connection_type == "oauth",
        CloudflareConnection.verified        == True,
    )
    if connection_id:
        query = query.filter(CloudflareConnection.id == connection_id)
    conn = query.first()
    if not conn:
        raise HTTPException(status_code=404, detail="No Cloudflare OAuth connection found. Please sign in first.")

    try:
        token = cf.get_fresh_token(db, conn)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Cloudflare session expired. Please sign in again.",
        )

    zones = cf.list_zones(token)
    return {
        "connection_id": conn.id,
        "account_name":  conn.account_name,
        "zones":         zones,
    }


# ─── 5. Apply DNS ─────────────────────────────────────────────────────────────

@router.post("/apply/{domain_id}")
def apply_dns(
    domain_id:     int,
    zone_id:       str,
    connection_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Auto-create / update all DNS records for a domain via Cloudflare.
    Creates SPF, DKIM, DMARC, and Tracking CNAME. Safe: detects conflicts.
    """
    domain = db.query(Domain).filter(
        Domain.id == domain_id, Domain.owner_id == current_user.id
    ).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    query = db.query(CloudflareConnection).filter(
        CloudflareConnection.owner_id       == current_user.id,
        CloudflareConnection.connection_type == "oauth",
        CloudflareConnection.verified        == True,
    )
    if connection_id:
        query = query.filter(CloudflareConnection.id == connection_id)
    conn = query.first()
    if not conn:
        raise HTTPException(status_code=404, detail="No Cloudflare connection found. Please sign in first.")

    try:
        token = cf.get_fresh_token(db, conn)
    except Exception:
        raise HTTPException(status_code=401, detail="Session expired — please reconnect Cloudflare")

    # Pin zone on connection + domain
    conn.zone_id  = zone_id
    zone_info     = next((z for z in cf.list_zones(token) if z["id"] == zone_id), None)
    conn.zone_name = zone_info["name"] if zone_info else zone_id
    domain.cloudflare_zone_id = zone_id
    db.commit()

    # Generate all required DNS records
    record_defs = generate_dns_records(
        domain.domain,
        domain.dkim_selector,
        domain.dkim_public_key or "",
        tracking_subdomain = domain.tracking_cname,
        bounce_subdomain   = domain.bounce_subdomain,
    )

    cf_map = {
        "SPF":      ("TXT",   record_defs["spf"]["host"],      record_defs["spf"]["value"]),
        "DKIM":     ("TXT",   record_defs["dkim"]["host"],     record_defs["dkim"]["value"]),
        "DMARC":    ("TXT",   record_defs["dmarc"]["host"],    record_defs["dmarc"]["value"]),
        "TRACKING": ("CNAME", record_defs["tracking"]["host"], record_defs["tracking"]["value"]),
    }

    now      = datetime.now(timezone.utc)
    applied  = failed = conflicts = 0
    results  = []

    for rtype, (cf_type, name, content) in cf_map.items():
        cf_id = cf.upsert_dns_record(token, zone_id, cf_type, name, content)
        row   = db.query(DnsRecord).filter_by(domain_id=domain.id, record_type=rtype).first()

        if cf_id:
            applied += 1
            if row:
                row.cloudflare_record_id = cf_id
                row.expected_value       = content
                row.found_value          = content
                row.status               = "valid"
                row.last_checked_at      = now
            results.append({"record_type": rtype, "status": "applied", "cf_id": cf_id})
        else:
            failed += 1
            if row:
                row.status = "conflict"
            results.append({"record_type": rtype, "status": "failed"})
            conflicts += 1

    # Mark domain active when core 3 records are in
    domain.last_checked_at = now
    if applied >= 3:
        domain.spf_valid   = True
        domain.dkim_valid  = True
        domain.dmarc_valid = True
        domain.status      = "active"
        domain.verified_at = now

    db.commit()

    return {
        "domain":    domain.domain,
        "zone_id":   zone_id,
        "applied":   applied,
        "failed":    failed,
        "conflicts": conflicts,
        "records":   results,
    }


# ─── 6. Disconnect ────────────────────────────────────────────────────────────

@router.delete("/disconnect/{connection_id}")
def disconnect(
    connection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conn = db.query(CloudflareConnection).filter(
        CloudflareConnection.id       == connection_id,
        CloudflareConnection.owner_id == current_user.id,
    ).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Best-effort token revocation
    for enc in [conn.encrypted_access_token, conn.encrypted_refresh_token]:
        if enc:
            try:
                cf.revoke_token(cf.decrypt(enc), db=db)
            except Exception:
                pass

    # Clear CF record IDs from dns_records (records remain in Cloudflare)
    db.query(DnsRecord).filter(
        DnsRecord.domain_id.in_(
            db.query(Domain.id).filter(Domain.owner_id == current_user.id)
        ),
        DnsRecord.cloudflare_record_id.isnot(None),
    ).update({"cloudflare_record_id": None}, synchronize_session=False)

    db.delete(conn)
    db.commit()

    return {"success": True, "message": "Cloudflare account disconnected"}
