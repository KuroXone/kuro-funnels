import smtplib
import time
import uuid
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
from ..models.smtp import SMTPServer
from ..config import settings

logger = logging.getLogger(__name__)

# Timeout constants
SEND_TIMEOUT = 20   # seconds for a full send
TEST_TIMEOUT = 10   # seconds for a connection test


def _build_connection(smtp_server: SMTPServer, timeout: int):
    """
    Return an authenticated, ready-to-use smtplib connection.
    Caller is responsible for closing it (use as context manager where possible).
    """
    if smtp_server.secure and smtp_server.port == 465:
        conn = smtplib.SMTP_SSL(smtp_server.host, smtp_server.port, timeout=timeout)
    else:
        conn = smtplib.SMTP(smtp_server.host, smtp_server.port, timeout=timeout)
        if smtp_server.secure:
            conn.starttls()

    conn.login(smtp_server.username, smtp_server.password)
    return conn


def _classify_error(exc: Exception) -> str:
    """Return a human-readable error message from an smtplib/socket exception."""
    msg = str(exc)
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return f"Authentication failed — check your username and password ({msg})"
    if isinstance(exc, smtplib.SMTPConnectError):
        return f"Could not connect to {msg}"
    if isinstance(exc, smtplib.SMTPRecipientsRefused):
        return f"Recipient(s) refused by server: {msg}"
    if isinstance(exc, smtplib.SMTPSenderRefused):
        return f"Sender address refused: {msg}"
    if isinstance(exc, TimeoutError):
        return "Connection timed out — check host/port"
    if "Connection refused" in msg:
        return "Connection refused — check host and port"
    if "SSL" in msg or "TLS" in msg:
        return f"SSL/TLS error — try toggling the secure option ({msg})"
    return msg


def send_email_via_smtp(
    smtp_server: SMTPServer,
    to_email: str,
    subject: str,
    html_content: str,
    from_name: str,
    from_email: str,
    text_content: Optional[str] = None,
    reply_to: Optional[str] = None,
    tracking_id: Optional[str] = None,
) -> dict:
    """
    Send a single email through the given SMTP server.
    Returns {"success": True/False, "tracking_id": str, "latency_ms": int, "error": str|None}.
    Never raises — all exceptions are caught and returned in the result dict.
    """
    tracking_id = tracking_id or str(uuid.uuid4())

    # Inject 1×1 open-tracking pixel
    pixel = (
        f'<img src="{settings.BACKEND_URL}/analytics/track/open/{tracking_id}"'
        ' width="1" height="1" style="display:none" alt="">'
    )
    html_with_pixel = html_content + pixel

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    if reply_to:
        msg["Reply-To"] = reply_to

    if text_content:
        msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_with_pixel, "html", "utf-8"))

    start = time.time()
    try:
        conn = _build_connection(smtp_server, SEND_TIMEOUT)
        try:
            conn.sendmail(from_email, [to_email], msg.as_string())
        finally:
            try:
                conn.quit()
            except Exception:
                pass

        latency_ms = int((time.time() - start) * 1000)
        logger.debug("Sent email to %s via %s in %dms", to_email, smtp_server.name, latency_ms)
        return {"success": True, "tracking_id": tracking_id, "latency_ms": latency_ms}

    except Exception as exc:
        error_msg = _classify_error(exc)
        logger.warning("Email to %s via %s failed: %s", to_email, smtp_server.name, error_msg)
        return {"success": False, "error": error_msg, "tracking_id": tracking_id, "latency_ms": None}


def test_smtp_connection(smtp_server: SMTPServer) -> dict:
    """
    Test SMTP connectivity and authentication without sending an email.
    Returns {"success": True/False, "message": str, "latency_ms": int|None}.
    Never raises.
    """
    start = time.time()
    try:
        conn = _build_connection(smtp_server, TEST_TIMEOUT)
        try:
            conn.quit()
        except Exception:
            pass

        latency_ms = int((time.time() - start) * 1000)
        return {"success": True, "message": "Connection successful", "latency_ms": latency_ms}

    except Exception as exc:
        return {"success": False, "message": _classify_error(exc), "latency_ms": None}
