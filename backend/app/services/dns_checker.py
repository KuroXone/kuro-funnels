"""
DNS verification service.
Checks SPF, DKIM, DMARC, and MX records for a domain.
"""
import re
from typing import Optional

try:
    import dns.resolver
    import dns.exception
    DNS_AVAILABLE = True
except ImportError:
    DNS_AVAILABLE = False


def _query_txt(host: str) -> list[str]:
    """Return all TXT record values for a hostname."""
    if not DNS_AVAILABLE:
        return []
    try:
        answers = dns.resolver.resolve(host, "TXT", lifetime=5)
        return [b"".join(r.strings).decode("utf-8", errors="ignore") for r in answers]
    except Exception:
        return []


def _query_mx(domain: str) -> list[str]:
    if not DNS_AVAILABLE:
        return []
    try:
        answers = dns.resolver.resolve(domain, "MX", lifetime=5)
        return [str(r.exchange).rstrip(".") for r in answers]
    except Exception:
        return []


def check_spf(domain: str) -> dict:
    records = _query_txt(domain)
    spf_records = [r for r in records if r.startswith("v=spf1")]

    if not spf_records:
        return {
            "valid": False,
            "record": None,
            "message": "No SPF record found. Add a TXT record with v=spf1 ...",
        }

    record = spf_records[0]
    # Must end with -all, ~all, or ?all
    valid = bool(re.search(r"[~\-\?]all$", record))
    return {
        "valid": valid,
        "record": record,
        "message": "SPF record found and valid." if valid else "SPF record found but policy is too permissive (use ~all or -all).",
    }


def check_dkim(domain: str, selector: str = "kuro") -> dict:
    host = f"{selector}._domainkey.{domain}"
    records = _query_txt(host)
    dkim_records = [r for r in records if "v=DKIM1" in r or "k=rsa" in r]

    if not dkim_records:
        return {
            "valid": False,
            "record": None,
            "host": host,
            "message": f"No DKIM record found at {host}",
        }

    record = dkim_records[0]
    valid = "v=DKIM1" in record and ("p=" in record)
    # Check the public key isn't revoked (empty p=)
    if 'p=""' in record or "p= " in record:
        valid = False
        msg = "DKIM record found but key is revoked (empty p= value)."
    else:
        msg = "DKIM record found and valid." if valid else "DKIM record found but malformed."

    return {"valid": valid, "record": record[:120] + "..." if len(record) > 120 else record, "host": host, "message": msg}


def check_dmarc(domain: str) -> dict:
    host = f"_dmarc.{domain}"
    records = _query_txt(host)
    dmarc_records = [r for r in records if r.startswith("v=DMARC1")]

    if not dmarc_records:
        return {
            "valid": False,
            "record": None,
            "host": host,
            "message": f"No DMARC record found at {host}",
        }

    record = dmarc_records[0]
    # Check policy
    policy_match = re.search(r"p=(none|quarantine|reject)", record)
    policy = policy_match.group(1) if policy_match else "none"
    valid = policy in ("quarantine", "reject")

    return {
        "valid": valid,
        "record": record,
        "host": host,
        "policy": policy,
        "message": f"DMARC found, policy={policy}." + ("" if valid else " Consider upgrading to quarantine or reject."),
    }


def check_mx(domain: str) -> dict:
    mx_records = _query_mx(domain)
    valid = len(mx_records) > 0
    return {
        "valid": valid,
        "records": mx_records,
        "message": f"Found {len(mx_records)} MX record(s)." if valid else "No MX records found.",
    }


def check_all(domain: str, dkim_selector: str = "kuro") -> dict:
    return {
        "spf": check_spf(domain),
        "dkim": check_dkim(domain, dkim_selector),
        "dmarc": check_dmarc(domain),
        "mx": check_mx(domain),
        "dns_available": DNS_AVAILABLE,
    }
