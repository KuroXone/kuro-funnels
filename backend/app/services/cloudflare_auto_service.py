"""
Cloudflare automatic DNS service.
Uses CLOUDFLARE_API_TOKEN from environment — no OAuth, no UI.
Called server-side only when a domain is added.
"""
import httpx
from typing import Optional
from ..config import settings

CF_API = "https://api.cloudflare.com/client/v4"


def is_configured() -> bool:
    return bool(settings.CLOUDFLARE_API_TOKEN)


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.CLOUDFLARE_API_TOKEN}",
        "Content-Type": "application/json",
    }


def find_zone(domain: str) -> Optional[str]:
    """
    Return the Cloudflare zone ID that owns this domain.
    Walks up the domain tree: sub.example.com → example.com → com
    """
    try:
        r = httpx.get(
            f"{CF_API}/zones",
            headers=_headers(),
            params={"per_page": 100, "status": "active"},
            timeout=10,
        )
        data = r.json()
        if not data.get("success"):
            return None
        zone_map = {z["name"]: z["id"] for z in data["result"]}
        parts = domain.split(".")
        for i in range(len(parts) - 1):
            candidate = ".".join(parts[i:])
            if candidate in zone_map:
                return zone_map[candidate]
    except Exception:
        pass
    return None


def upsert_record(
    zone_id: str, rtype: str, name: str, content: str,
    proxied: bool = False, ttl: int = 1,
) -> Optional[str]:
    """Create or update a DNS record. Returns Cloudflare record ID or None on failure."""
    try:
        r = httpx.get(
            f"{CF_API}/zones/{zone_id}/dns_records",
            headers=_headers(),
            params={"type": rtype, "name": name, "per_page": 5},
            timeout=10,
        )
        data = r.json()
        existing = data.get("result", []) if data.get("success") else []
        payload = {"type": rtype, "name": name, "content": content, "ttl": ttl, "proxied": proxied}

        if existing:
            rec_id = existing[0]["id"]
            r2 = httpx.put(
                f"{CF_API}/zones/{zone_id}/dns_records/{rec_id}",
                headers=_headers(),
                json=payload,
                timeout=10,
            )
            return rec_id if r2.json().get("success") else None
        else:
            r2 = httpx.post(
                f"{CF_API}/zones/{zone_id}/dns_records",
                headers=_headers(),
                json=payload,
                timeout=10,
            )
            result = r2.json()
            return result["result"]["id"] if result.get("success") else None
    except Exception:
        return None


def apply_all_records(
    domain_name: str,
    dkim_selector: str,
    dkim_public_key: str,
    tracking_cname: str = None,
) -> dict:
    """
    Find the zone for domain_name and push SPF, DKIM, DMARC, tracking CNAME.
    Returns {zone_id, applied, failed, records} or {error, applied:0, failed:0}.
    """
    if not is_configured():
        return {"error": "CLOUDFLARE_API_TOKEN not set", "applied": 0, "failed": 0, "records": []}

    zone_id = find_zone(domain_name)
    if not zone_id:
        return {
            "error": f"No active Cloudflare zone found for {domain_name}",
            "applied": 0,
            "failed": 0,
            "records": [],
        }

    track = tracking_cname or f"track.{domain_name}"

    chunks = [dkim_public_key[i:i + 253] for i in range(0, len(dkim_public_key), 253)]
    dkim_value = "v=DKIM1; k=rsa; p=" + "\" \"".join(chunks)

    record_defs = [
        ("SPF",      "TXT",   domain_name,                                  "v=spf1 a mx ~all"),
        ("DKIM",     "TXT",   f"{dkim_selector}._domainkey.{domain_name}",  dkim_value),
        ("DMARC",    "TXT",   f"_dmarc.{domain_name}",
         f"v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@{domain_name}; fo=1"),
        ("TRACKING", "CNAME", track,                                         domain_name),
    ]

    applied = failed = 0
    results = []

    for rtype, cf_type, name, content in record_defs:
        rec_id = upsert_record(zone_id, cf_type, name, content)
        if rec_id:
            applied += 1
            results.append({"record_type": rtype, "status": "applied", "cf_id": rec_id})
        else:
            failed += 1
            results.append({"record_type": rtype, "status": "failed"})

    return {"zone_id": zone_id, "applied": applied, "failed": failed, "records": results}
