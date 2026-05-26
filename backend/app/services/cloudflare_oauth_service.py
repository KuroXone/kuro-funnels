"""
Cloudflare OAuth 2.0 service.
Credentials are read first from the database (set via the UI), then from .env.
This allows zero-restart credential setup through the admin interface.
"""
import secrets
import base64
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional
from urllib.parse import urlencode

try:
    import httpx
    HTTPX_OK = True
except ImportError:
    HTTPX_OK = False

from cryptography.fernet import Fernet
from ..config import settings

CF_API = "https://api.cloudflare.com/client/v4"


# ── encryption ───────────────────────────────────────────────────────────────

def _fernet_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)

def encrypt(value: str) -> str:
    return Fernet(_fernet_key(settings.SECRET_KEY)).encrypt(value.encode()).decode()

def decrypt(value: str) -> str:
    return Fernet(_fernet_key(settings.SECRET_KEY)).decrypt(value.encode()).decode()


# ── runtime credential resolution ────────────────────────────────────────────

def _resolve_credentials(db=None) -> tuple[str, str]:
    """Return (client_id, client_secret) from DB first, then .env fallback."""
    client_id = client_secret = ""
    if db is not None:
        try:
            from ..services.settings_service import get_setting
            client_id     = get_setting(db, "CF_CLIENT_ID")     or ""
            client_secret = get_setting(db, "CF_CLIENT_SECRET") or ""
        except Exception:
            pass
    return (
        client_id     or settings.CF_CLIENT_ID,
        client_secret or settings.CF_CLIENT_SECRET,
    )


def is_configured(db=None) -> bool:
    cid, csecret = _resolve_credentials(db)
    return bool(cid and csecret)


# ── state ────────────────────────────────────────────────────────────────────

def generate_state() -> str:
    return secrets.token_urlsafe(32)


# ── OAuth URL ─────────────────────────────────────────────────────────────────

def build_authorize_url(state: str, db=None) -> str:
    cid, _ = _resolve_credentials(db)
    params = {
        "response_type": "code",
        "client_id": cid,
        "redirect_uri": settings.CF_REDIRECT_URI,
        "scope": settings.CF_OAUTH_SCOPES,
        "state": state,
    }
    return f"{settings.CF_AUTH_URL}?{urlencode(params)}"


# ── Token exchange ─────────────────────────────────────────────────────────────

def exchange_code(code: str, db=None) -> dict:
    """Exchange authorization code for access + refresh tokens."""
    if not HTTPX_OK:
        raise RuntimeError("httpx not installed — pip install httpx")
    cid, csecret = _resolve_credentials(db)
    resp = httpx.post(
        settings.CF_TOKEN_URL,
        data={
            "grant_type":    "authorization_code",
            "code":          code,
            "redirect_uri":  settings.CF_REDIRECT_URI,
            "client_id":     cid,
            "client_secret": csecret,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15,
    )
    if not resp.is_success:
        try:
            err = resp.json()
            msg = err.get("error_description") or err.get("error") or resp.text
        except Exception:
            msg = resp.text
        raise ValueError(f"Cloudflare token exchange failed ({resp.status_code}): {msg}")
    return resp.json()


def refresh_access_token(refresh_token: str, db=None) -> dict:
    """Use refresh token to get a new access token."""
    if not HTTPX_OK:
        raise RuntimeError("httpx not installed")
    cid, csecret = _resolve_credentials(db)
    resp = httpx.post(
        settings.CF_TOKEN_URL,
        data={
            "grant_type":    "refresh_token",
            "refresh_token": refresh_token,
            "client_id":     cid,
            "client_secret": csecret,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15,
    )
    if not resp.is_success:
        try:
            err = resp.json()
            msg = err.get("error_description") or err.get("error") or resp.text
        except Exception:
            msg = resp.text
        raise ValueError(f"Token refresh failed ({resp.status_code}): {msg}")
    return resp.json()


def revoke_token(token: str, db=None) -> bool:
    """Best-effort token revocation."""
    if not HTTPX_OK:
        return False
    cid, csecret = _resolve_credentials(db)
    try:
        resp = httpx.post(
            settings.CF_REVOKE_URL,
            data={"token": token, "client_id": cid, "client_secret": csecret},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
        return resp.status_code in (200, 204)
    except Exception:
        return False


# ── Cloudflare API helpers ────────────────────────────────────────────────────

def _auth_headers(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}


def get_account_info(access_token: str) -> Optional[dict]:
    if not HTTPX_OK:
        return None
    try:
        r = httpx.get(f"{CF_API}/accounts", headers=_auth_headers(access_token), timeout=10)
        data = r.json()
        if data.get("success") and data.get("result"):
            acct = data["result"][0]
            return {"id": acct["id"], "name": acct["name"]}
    except Exception:
        pass
    return None


def list_zones(access_token: str) -> list:
    if not HTTPX_OK:
        return []
    try:
        r = httpx.get(
            f"{CF_API}/zones",
            headers=_auth_headers(access_token),
            params={"per_page": 100, "status": "active"},
            timeout=10,
        )
        data = r.json()
        return [
            {
                "id":     z["id"],
                "name":   z["name"],
                "status": z["status"],
                "plan":   z.get("plan", {}).get("name", "Free"),
            }
            for z in data.get("result", [])
        ] if data.get("success") else []
    except Exception:
        return []


def upsert_dns_record(
    access_token: str, zone_id: str, rtype: str, name: str, content: str, ttl: int = 3600
) -> Optional[str]:
    """Create or update a DNS record. Returns CF record ID, or None on failure/conflict."""
    if not HTTPX_OK:
        return None
    try:
        r = httpx.get(
            f"{CF_API}/zones/{zone_id}/dns_records",
            headers=_auth_headers(access_token),
            params={"type": rtype, "name": name, "per_page": 5},
            timeout=10,
        )
        existing = r.json().get("result", []) if r.json().get("success") else []
        payload = {"type": rtype, "name": name, "content": content, "ttl": ttl, "proxied": False}

        if existing:
            rec_id = existing[0]["id"]
            if existing[0]["type"] != rtype:
                return None  # type conflict — don't overwrite
            r2 = httpx.put(
                f"{CF_API}/zones/{zone_id}/dns_records/{rec_id}",
                headers=_auth_headers(access_token),
                json=payload,
                timeout=10,
            )
            return rec_id if r2.json().get("success") else None
        else:
            r2 = httpx.post(
                f"{CF_API}/zones/{zone_id}/dns_records",
                headers=_auth_headers(access_token),
                json=payload,
                timeout=10,
            )
            result = r2.json()
            return result["result"]["id"] if result.get("success") else None
    except Exception:
        return None


def delete_dns_record(access_token: str, zone_id: str, record_id: str) -> bool:
    if not HTTPX_OK:
        return False
    try:
        r = httpx.delete(
            f"{CF_API}/zones/{zone_id}/dns_records/{record_id}",
            headers=_auth_headers(access_token),
            timeout=10,
        )
        return r.json().get("success", False)
    except Exception:
        return False


def get_zone_by_domain(access_token: str, domain: str) -> Optional[dict]:
    zones = list_zones(access_token)
    parts = domain.split(".")
    for i in range(len(parts) - 1):
        candidate = ".".join(parts[i:])
        for z in zones:
            if z["name"] == candidate:
                return z
    return None


# ── DB token refresh helper ───────────────────────────────────────────────────

def get_fresh_token(db, connection) -> str:
    """Return a valid access token, refreshing automatically when near expiry."""
    now = datetime.now(timezone.utc)
    needs_refresh = (
        connection.token_expires_at is None
        or connection.token_expires_at <= now + timedelta(minutes=5)
    )
    if needs_refresh and connection.encrypted_refresh_token:
        try:
            rt = decrypt(connection.encrypted_refresh_token)
            token_data = refresh_access_token(rt, db=db)
            connection.encrypted_access_token = encrypt(token_data["access_token"])
            if "refresh_token" in token_data:
                connection.encrypted_refresh_token = encrypt(token_data["refresh_token"])
            connection.token_expires_at = now + timedelta(seconds=token_data.get("expires_in", 3600))
            db.commit()
        except Exception:
            pass  # fall through and try with existing token

    return decrypt(connection.encrypted_access_token)
