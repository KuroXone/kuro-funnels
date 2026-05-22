"""
Reputation tracking service.
Calculates sender reputation based on delivery metrics.
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, timedelta
from ..models.analytics import SendLog
from ..models.smtp import SMTPServer, SMTPStatus


def calculate_smtp_reputation(smtp_id: int, db: Session) -> dict:
    """
    Calculate reputation metrics for a single SMTP server
    based on the last 7 days of send logs.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    logs = (
        db.query(SendLog)
        .filter(SendLog.smtp_id == smtp_id, SendLog.created_at >= cutoff)
        .all()
    )

    total = len(logs)
    if total == 0:
        return {"total": 0, "sent": 0, "failed": 0, "bounced": 0,
                "bounce_rate": 0.0, "success_rate": 100.0, "reputation_score": 100.0}

    sent = sum(1 for l in logs if l.status == "sent")
    failed = sum(1 for l in logs if l.status == "failed")
    bounced = sum(1 for l in logs if l.status == "bounced")

    bounce_rate = (bounced / total) * 100 if total else 0
    success_rate = (sent / total) * 100 if total else 100

    # Reputation formula: start at 100, penalize for bounces/failures
    reputation = 100.0
    reputation -= bounce_rate * 2       # each 1% bounce = -2 points
    reputation -= (failed / total * 100) * 0.5  # failures are less severe
    reputation = max(0.0, min(100.0, reputation))

    return {
        "total": total,
        "sent": sent,
        "failed": failed,
        "bounced": bounced,
        "bounce_rate": round(bounce_rate, 2),
        "success_rate": round(success_rate, 2),
        "reputation_score": round(reputation, 1),
    }


def update_smtp_reputation(smtp_id: int, db: Session) -> float:
    """Recalculate and persist reputation score for an SMTP server."""
    smtp = db.query(SMTPServer).filter(SMTPServer.id == smtp_id).first()
    if not smtp:
        return 0.0

    metrics = calculate_smtp_reputation(smtp_id, db)
    smtp.reputation_score = metrics["reputation_score"]

    # Auto-pause if reputation drops too low
    if metrics["bounce_rate"] > 10 and smtp.status == SMTPStatus.active:
        smtp.status = SMTPStatus.error
        smtp.last_error = f"Auto-paused: bounce rate {metrics['bounce_rate']:.1f}% exceeds 10% threshold"
    elif metrics["reputation_score"] < 20 and smtp.status == SMTPStatus.active:
        smtp.status = SMTPStatus.error
        smtp.last_error = f"Auto-paused: reputation score {metrics['reputation_score']:.0f} critically low"

    db.commit()
    return metrics["reputation_score"]


def get_smtp_health_stats(smtp: SMTPServer, db: Session) -> dict:
    """
    Return a comprehensive health snapshot for display in the SMTP health monitor.
    """
    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)

    sent_hour = db.query(func.count(SendLog.id)).filter(
        SendLog.smtp_id == smtp.id,
        SendLog.created_at >= hour_ago,
        SendLog.status == "sent",
    ).scalar() or 0

    sent_day = db.query(func.count(SendLog.id)).filter(
        SendLog.smtp_id == smtp.id,
        SendLog.created_at >= day_ago,
        SendLog.status == "sent",
    ).scalar() or 0

    failed_day = db.query(func.count(SendLog.id)).filter(
        SendLog.smtp_id == smtp.id,
        SendLog.created_at >= day_ago,
        SendLog.status.in_(["failed", "bounced"]),
    ).scalar() or 0

    total_day = sent_day + failed_day
    success_rate = round((sent_day / total_day * 100) if total_day else 100.0, 1)
    bounce_rate = round((failed_day / total_day * 100) if total_day else 0.0, 1)

    hourly_pct = round((sent_hour / smtp.limit_per_hour * 100) if smtp.limit_per_hour else 0, 1)
    daily_pct = round((sent_day / smtp.limit_per_day * 100) if smtp.limit_per_day else 0, 1)

    is_cooldown = smtp.cooldown_until and smtp.cooldown_until > now

    return {
        "id": smtp.id,
        "name": smtp.name,
        "host": smtp.host,
        "port": smtp.port,
        "provider": smtp.provider,
        "status": smtp.status.value if hasattr(smtp.status, "value") else smtp.status,
        "reputation_score": round(smtp.reputation_score or 100.0, 1),
        "sent_last_hour": sent_hour,
        "sent_last_24h": sent_day,
        "success_rate": success_rate,
        "bounce_rate": bounce_rate,
        "limit_per_hour": smtp.limit_per_hour,
        "limit_per_day": smtp.limit_per_day,
        "hourly_usage_pct": hourly_pct,
        "daily_usage_pct": daily_pct,
        "is_cooldown": bool(is_cooldown),
        "cooldown_until": smtp.cooldown_until.isoformat() if is_cooldown else None,
        "last_tested_at": smtp.last_tested_at.isoformat() if smtp.last_tested_at else None,
        "last_error": smtp.last_error,
        "weight": smtp.weight,
    }
