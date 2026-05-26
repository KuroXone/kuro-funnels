"""
Cloudflare API v4 integration service.
Handles token verification, zone lookup, and DNS record CRUD.
"""
import base64
import os
from typing import Optional
from cryptography.fernet import Fernet
import hashlib

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

CF_API = "https://api.cloudflare.com/client/v4"


def _make_key(secret: str) -> bytes:
    """Derive a 32-byte Fernet key from SECRET_KEY."""
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_token(token: str, secret: str) -> str:
    f = Fernet(_make_key(secret))
    return f.encrypt(token.encode()).decode()


def decrypt_token(encrypted: str, secret: str) -> str:
    f = Fernet(_make_key(secret))
    return f.decrypt(encrypted.encode()).decode()


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def verify_token(token: str) -> dict:
    """Verify a CF API token and return user info."""
    if not HTTPX_AVAILABLE:
        return {"success": False, "error": "httpx not installed"}
    try:
        r = httpx.get(f"{CF_API}/user/tokens/verify", headers=_headers(token), timeout=10)
        data = r.json()
        return {"success": data.get("success", False), "error": data.get("errors", [{}])[0].get("message") if not data.get("success") else None}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_user_info(token: str) -> dict:
    """Fetch Cloudflare user email + id from /user endpoint."""
    if not HTTPX_AVAILABLE:
        return {}
    try:
        r = httpx.get(f"{CF_API}/user", headers=_headers(token), timeout=10)
        data = r.json()
        if data.get("success"):
            u = data["result"]
            return {"email": u.get("email", ""), "id": u.get("id", "")}
    except Exception:
        pass
    return {}


def list_zones(token: str) -> list[dict]:
    """List all zones accessible by the token."""
    if not HTTPX_AVAILABLE:
        return []
    try:
        r = httpx.get(f"{CF_API}/zones", headers=_headers(token), params={"per_page": 100}, timeout=10)
        data = r.json()
        if not data.get("success"):
            return []
        return [
            {
                "id": z["id"],
                "name": z["name"],
                "status": z["status"],
                "plan": z.get("plan", {}).get("name", "Free"),
            }
            for z in data.get("result", [])
        ]
    except Exception:
        return []


def get_zone_by_domain(token: str, domain: str) -> Optional[dict]:
    """Find the Cloudflare zone matching domain (or its parent)."""
    zones = list_zones(token)
    parts = domain.split(".")
    for i in range(len(parts) - 1):
        candidate = ".".join(parts[i:])
        for z in zones:
            if z["name"] == candidate:
                return z
    return None


def list_dns_records(token: str, zone_id: str, name: str = None, record_type: str = None) -> list[dict]:
    """List DNS records in a zone, optionally filtered by name/type."""
    if not HTTPX_AVAILABLE:
        return []
    try:
        params = {"per_page": 100}
        if name:
            params["name"] = name
        if record_type:
            params["type"] = record_type
        r = httpx.get(f"{CF_API}/zones/{zone_id}/dns_records", headers=_headers(token), params=params, timeout=10)
        data = r.json()
        return data.get("result", []) if data.get("success") else []
    except Exception:
        return []


def create_dns_record(token: str, zone_id: str, record_type: str, name: str, content: str, ttl: int = 3600, proxied: bool = False) -> Optional[dict]:
    """Create a DNS record. Returns CF record dict or None on failure."""
    if not HTTPX_AVAILABLE:
        return None
    try:
        payload = {"type": record_type, "name": name, "content": content, "ttl": ttl, "proxied": proxied}
        r = httpx.post(f"{CF_API}/zones/{zone_id}/dns_records", headers=_headers(token), json=payload, timeout=10)
        data = r.json()
        return data.get("result") if data.get("success") else None
    except Exception:
        return None


def update_dns_record(token: str, zone_id: str, record_id: str, record_type: str, name: str, content: str, ttl: int = 3600) -> bool:
    """Update an existing CF DNS record."""
    if not HTTPX_AVAILABLE:
        return False
    try:
        payload = {"type": record_type, "name": name, "content": content, "ttl": ttl, "proxied": False}
        r = httpx.put(f"{CF_API}/zones/{zone_id}/dns_records/{record_id}", headers=_headers(token), json=payload, timeout=10)
        return r.json().get("success", False)
    except Exception:
        return False


def delete_dns_record(token: str, zone_id: str, record_id: str) -> bool:
    """Delete a CF DNS record."""
    if not HTTPX_AVAILABLE:
        return False
    try:
        r = httpx.delete(f"{CF_API}/zones/{zone_id}/dns_records/{record_id}", headers=_headers(token), timeout=10)
        return r.json().get("success", False)
    except Exception:
        return False


def upsert_dns_record(token: str, zone_id: str, record_type: str, name: str, content: str, ttl: int = 3600) -> Optional[str]:
    """Create or update a DNS record; return the CF record ID."""
    existing = list_dns_records(token, zone_id, name=name, record_type=record_type)
    if existing:
        rec_id = existing[0]["id"]
        ok = update_dns_record(token, zone_id, rec_id, record_type, name, content, ttl)
        return rec_id if ok else None
    result = create_dns_record(token, zone_id, record_type, name, content, ttl)
    return result["id"] if result else None
