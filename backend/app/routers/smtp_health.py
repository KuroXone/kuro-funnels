from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models.smtp import SMTPServer, SMTPStatus
from ..models.user import User
from ..auth.dependencies import get_current_user
from ..services.reputation_service import get_smtp_health_stats, update_smtp_reputation

router = APIRouter(prefix="/smtp-health", tags=["smtp-health"])


@router.get("/")
def get_all_smtp_health(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return live health stats for all SMTP servers belonging to the user."""
    smtps = (
        db.query(SMTPServer)
        .filter(SMTPServer.owner_id == current_user.id)
        .order_by(SMTPServer.created_at.desc())
        .all()
    )
    return [get_smtp_health_stats(s, db) for s in smtps]


@router.get("/{smtp_id}")
def get_smtp_health(
    smtp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    smtp = db.query(SMTPServer).filter(
        SMTPServer.id == smtp_id,
        SMTPServer.owner_id == current_user.id,
    ).first()
    if not smtp:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="SMTP not found")
    return get_smtp_health_stats(smtp, db)


@router.post("/{smtp_id}/recalculate")
def recalculate_reputation(
    smtp_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    smtp = db.query(SMTPServer).filter(
        SMTPServer.id == smtp_id,
        SMTPServer.owner_id == current_user.id,
    ).first()
    if not smtp:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="SMTP not found")

    new_score = update_smtp_reputation(smtp_id, db)
    return {"smtp_id": smtp_id, "reputation_score": new_score}


@router.get("/overview/summary")
def health_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregate health summary across all SMTPs."""
    smtps = db.query(SMTPServer).filter(SMTPServer.owner_id == current_user.id).all()
    if not smtps:
        return {"total": 0, "active": 0, "error": 0, "avg_reputation": 0, "avg_success_rate": 0}

    stats = [get_smtp_health_stats(s, db) for s in smtps]
    active = sum(1 for s in stats if s["status"] == "active")
    error = sum(1 for s in stats if s["status"] == "error")
    avg_rep = round(sum(s["reputation_score"] for s in stats) / len(stats), 1)
    avg_success = round(sum(s["success_rate"] for s in stats) / len(stats), 1)
    total_sent_24h = sum(s["sent_last_24h"] for s in stats)

    return {
        "total": len(smtps),
        "active": active,
        "error": error,
        "paused": len(smtps) - active - error,
        "avg_reputation": avg_rep,
        "avg_success_rate": avg_success,
        "total_sent_24h": total_sent_24h,
    }
