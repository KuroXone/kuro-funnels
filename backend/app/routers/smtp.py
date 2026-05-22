from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from ..database import get_db
from ..models.smtp import SMTPServer, SMTPStats, SMTPStatus
from ..models.user import User
from ..schemas.smtp import SMTPCreate, SMTPUpdate, SMTPOut, SMTPTestResult
from ..auth.dependencies import get_current_user
from ..services.email import test_smtp_connection, send_email_via_smtp


class SendTestEmailRequest(BaseModel):
    to_email: EmailStr
    subject: str = "SMTP Test — KuroFunnels"
    body: str = "<p>This is a test email from <strong>KuroFunnels</strong>.</p><p>Your SMTP server is working correctly.</p>"

router = APIRouter(prefix="/smtp", tags=["smtp"])


@router.get("/")
def list_smtps(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)

    q = db.query(SMTPServer).filter(SMTPServer.owner_id == current_user.id)
    if search:
        q = q.filter(
            SMTPServer.name.ilike(f"%{search}%") | SMTPServer.host.ilike(f"%{search}%")
        )
    if status:
        q = q.filter(SMTPServer.status == status)
    smtps = q.order_by(SMTPServer.created_at.desc()).all()

    result = []
    for s in smtps:
        sent_last_hour = db.query(func.coalesce(func.sum(SMTPStats.sent_count), 0)).filter(
            SMTPStats.smtp_id == s.id, SMTPStats.date >= hour_ago
        ).scalar() or 0
        sent_last_24h = db.query(func.coalesce(func.sum(SMTPStats.sent_count), 0)).filter(
            SMTPStats.smtp_id == s.id, SMTPStats.date >= day_ago
        ).scalar() or 0

        out = SMTPOut.model_validate(s)
        d = out.model_dump()
        d["sent_last_hour"] = sent_last_hour
        d["sent_last_24h"] = sent_last_24h
        result.append(d)
    return result


@router.post("/", response_model=SMTPOut, status_code=201)
def create_smtp(payload: SMTPCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    smtp = SMTPServer(**payload.model_dump(), owner_id=current_user.id)
    db.add(smtp)
    db.commit()
    db.refresh(smtp)
    return smtp


@router.get("/{smtp_id}", response_model=SMTPOut)
def get_smtp(smtp_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    smtp = db.query(SMTPServer).filter(SMTPServer.id == smtp_id, SMTPServer.owner_id == current_user.id).first()
    if not smtp:
        raise HTTPException(status_code=404, detail="SMTP not found")
    return smtp


@router.put("/{smtp_id}", response_model=SMTPOut)
def update_smtp(smtp_id: int, payload: SMTPUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    smtp = db.query(SMTPServer).filter(SMTPServer.id == smtp_id, SMTPServer.owner_id == current_user.id).first()
    if not smtp:
        raise HTTPException(status_code=404, detail="SMTP not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(smtp, field, value)
    db.commit()
    db.refresh(smtp)
    return smtp


@router.delete("/{smtp_id}", status_code=204)
def delete_smtp(smtp_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    smtp = db.query(SMTPServer).filter(SMTPServer.id == smtp_id, SMTPServer.owner_id == current_user.id).first()
    if not smtp:
        raise HTTPException(status_code=404, detail="SMTP not found")
    db.delete(smtp)
    db.commit()


@router.post("/{smtp_id}/test", response_model=SMTPTestResult)
def test_smtp(smtp_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    smtp = db.query(SMTPServer).filter(SMTPServer.id == smtp_id, SMTPServer.owner_id == current_user.id).first()
    if not smtp:
        raise HTTPException(status_code=404, detail="SMTP not found")
    result = test_smtp_connection(smtp)
    smtp.last_tested_at = datetime.now(timezone.utc)
    if not result["success"]:
        smtp.last_error = result["message"]
        smtp.status = SMTPStatus.error
    else:
        smtp.last_error = None
        smtp.status = SMTPStatus.active
    db.commit()
    return SMTPTestResult(**result)


@router.patch("/{smtp_id}/toggle")
def toggle_smtp(smtp_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    smtp = db.query(SMTPServer).filter(SMTPServer.id == smtp_id, SMTPServer.owner_id == current_user.id).first()
    if not smtp:
        raise HTTPException(status_code=404, detail="SMTP not found")
    smtp.status = SMTPStatus.paused if smtp.status == SMTPStatus.active else SMTPStatus.active
    db.commit()
    return {"id": smtp.id, "status": smtp.status}


@router.get("/{smtp_id}/stats")
def smtp_stats(smtp_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return aggregated send stats for an SMTP server."""
    smtp = db.query(SMTPServer).filter(SMTPServer.id == smtp_id, SMTPServer.owner_id == current_user.id).first()
    if not smtp:
        raise HTTPException(status_code=404, detail="SMTP not found")
    agg = db.query(
        func.coalesce(func.sum(SMTPStats.sent_count), 0).label("total_sent"),
        func.coalesce(func.sum(SMTPStats.failed_count), 0).label("total_failed"),
        func.coalesce(func.sum(SMTPStats.bounced_count), 0).label("total_bounced"),
    ).filter(SMTPStats.smtp_id == smtp_id).first()
    return {
        "smtp_id": smtp_id,
        "total_sent": agg.total_sent,
        "total_failed": agg.total_failed,
        "total_bounced": agg.total_bounced,
        "reputation_score": smtp.reputation_score,
        "status": smtp.status,
        "last_tested_at": smtp.last_tested_at,
        "last_error": smtp.last_error,
    }


@router.post("/{smtp_id}/send-test")
def send_test_email_from_smtp(
    smtp_id: int,
    payload: SendTestEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a standalone test email directly through a specific SMTP server."""
    smtp = db.query(SMTPServer).filter(SMTPServer.id == smtp_id, SMTPServer.owner_id == current_user.id).first()
    if not smtp:
        raise HTTPException(status_code=404, detail="SMTP not found")

    result = send_email_via_smtp(
        smtp_server=smtp,
        to_email=payload.to_email,
        subject=payload.subject,
        html_content=payload.body,
        from_name=current_user.full_name or current_user.username,
        from_email=current_user.email,
    )

    smtp.last_tested_at = datetime.now(timezone.utc)
    if result["success"]:
        smtp.last_error = None
        if smtp.status == SMTPStatus.error:
            smtp.status = SMTPStatus.active
    else:
        smtp.last_error = result.get("error")
        smtp.status = SMTPStatus.error
    db.commit()

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Send failed"))

    return {
        "message": "Test email sent successfully",
        "to": payload.to_email,
        "latency_ms": result.get("latency_ms"),
    }


@router.get("/overview/all")
def smtp_overview(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Summary stats for all SMTP servers — used by dashboard."""
    now = datetime.now(timezone.utc)
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)

    smtps = db.query(SMTPServer).filter(SMTPServer.owner_id == current_user.id).all()
    result = []
    for s in smtps:
        sent_last_hour = db.query(func.coalesce(func.sum(SMTPStats.sent_count), 0)).filter(
            SMTPStats.smtp_id == s.id, SMTPStats.date >= hour_ago
        ).scalar() or 0
        sent_last_24h = db.query(func.coalesce(func.sum(SMTPStats.sent_count), 0)).filter(
            SMTPStats.smtp_id == s.id, SMTPStats.date >= day_ago
        ).scalar() or 0
        result.append({
            "id": s.id,
            "name": s.name,
            "host": s.host,
            "status": s.status,
            "reputation_score": s.reputation_score,
            "limit_per_hour": s.limit_per_hour,
            "limit_per_day": s.limit_per_day,
            "provider": s.provider,
            "sent_last_hour": sent_last_hour,
            "sent_last_24h": sent_last_24h,
        })
    return result
