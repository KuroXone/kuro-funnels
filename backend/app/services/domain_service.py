"""
Domain management service.
Handles DKIM key generation and DNS record generation.
"""
import base64
from typing import Tuple


def generate_dkim_keys() -> Tuple[str, str]:
    """
    Generate a 2048-bit RSA key pair for DKIM signing.
    Returns (private_pem_str, public_b64_str)
    """
    try:
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.backends import default_backend

        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
            backend=default_backend(),
        )
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
        public_key = private_key.public_key()
        public_der = public_key.public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        public_b64 = base64.b64encode(public_der).decode()
        return private_pem.decode(), public_b64
    except Exception:
        # Fallback placeholder keys if cryptography is unavailable
        return "PRIVATE_KEY_UNAVAILABLE", "PUBLIC_KEY_UNAVAILABLE"


def generate_dns_records(domain: str, selector: str, public_key_b64: str) -> dict:
    """
    Generate the DNS TXT records needed to authenticate email from this domain.
    """
    # SPF — allows the domain's own servers + common ESP ranges
    spf = {
        "type": "TXT",
        "host": domain,
        "value": f"v=spf1 a mx include:sendgrid.net include:amazonses.com include:mailgun.org ~all",
        "ttl": 3600,
        "purpose": "Authorizes mail servers to send on behalf of your domain.",
    }

    # DKIM — publish the public key so receivers can verify signatures
    # Split into 255-char chunks if needed (DNS TXT limit)
    chunks = [public_key_b64[i:i+253] for i in range(0, len(public_key_b64), 253)]
    dkim_value = "v=DKIM1; k=rsa; p=" + "\" \"".join(chunks)
    dkim = {
        "type": "TXT",
        "host": f"{selector}._domainkey.{domain}",
        "value": dkim_value,
        "ttl": 3600,
        "purpose": "Publishes your DKIM public key so receivers can verify message signatures.",
    }

    # DMARC — policy for unauthenticated mail
    dmarc = {
        "type": "TXT",
        "host": f"_dmarc.{domain}",
        "value": f"v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@{domain}; ruf=mailto:dmarc-reports@{domain}; fo=1; adkim=s; aspf=s",
        "ttl": 3600,
        "purpose": "Instructs receivers what to do with unauthenticated mail and where to send reports.",
    }

    return {"spf": spf, "dkim": dkim, "dmarc": dmarc}


def get_domain_health_status(reputation: float, bounce_rate: float, complaint_rate: float) -> str:
    if bounce_rate > 10 or complaint_rate > 0.5:
        return "critical"
    if bounce_rate > 5 or complaint_rate > 0.2 or reputation < 40:
        return "warning"
    if reputation >= 80:
        return "excellent"
    if reputation >= 60:
        return "good"
    return "fair"
