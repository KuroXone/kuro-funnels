from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from ..database import get_db
from ..models.analytics import Analytics, SendLog, EmailQueue
from ..models.campaign import Campaign, CampaignStatus
from ..models.smtp import SMTPServer
from ..models.user import User
from ..auth.dependencies import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])

PIXEL_GIF = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04"
    b"\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
)


@router.get("/track/open/{tracking_id}")
def track_open(tracking_id: str, db: Session = Depends(get_db)):
    log = db.query(SendLog).filter(SendLog.tracking_id == tracking_id).first()
    if log and not log.opened_at:
        log.opened_at = datetime.now(timezone.utc)
        campaign_analytics = db.query(Analytics).filter(Analytics.campaign_id == log.campaign_id).first()
        if campaign_analytics:
            campaign_analytics.opens += 1
            campaign_analytics.unique_opens += 1
        db.commit()
    return Response(content=PIXEL_GIF, media_type="image/gif")


@router.get("/track/click/{tracking_id}")
def track_click(tracking_id: str, url: str, db: Session = Depends(get_db)):
    log = db.query(SendLog).filter(SendLog.tracking_id == tracking_id).first()
    if log and not log.clicked_at:
        log.clicked_at = datetime.now(timezone.utc)
        campaign_analytics = db.query(Analytics).filter(Analytics.campaign_id == log.campaign_id).first()
        if campaign_analytics:
            campaign_analytics.clicks += 1
            campaign_analytics.unique_clicks += 1
        db.commit()
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=url)


@router.get("/dashboard")
def dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_campaigns = db.query(Campaign.id).filter(Campaign.owner_id == current_user.id).subquery()

    totals = db.query(
        func.coalesce(func.sum(Analytics.sent), 0).label("total_sent"),
        func.coalesce(func.sum(Analytics.opens), 0).label("total_opens"),
        func.coalesce(func.sum(Analytics.clicks), 0).label("total_clicks"),
        func.coalesce(func.sum(Analytics.bounces), 0).label("total_bounces"),
    ).filter(Analytics.campaign_id.in_(user_campaigns)).first()

    smtp_count = db.query(SMTPServer).filter(SMTPServer.owner_id == current_user.id).count()
    active_smtp = db.query(SMTPServer).filter(
        SMTPServer.owner_id == current_user.id,
        SMTPServer.status == "active",
    ).count()

    campaign_count = db.query(Campaign).filter(Campaign.owner_id == current_user.id).count()
    active_campaigns = db.query(Campaign).filter(
        Campaign.owner_id == current_user.id,
        Campaign.status == CampaignStatus.sending,
    ).count()

    queue_pending = db.query(EmailQueue).join(Campaign).filter(
        Campaign.owner_id == current_user.id,
        EmailQueue.status.in_(["pending", "processing"]),
    ).count()

    sent = totals.total_sent or 0
    opens = totals.total_opens or 0
    clicks = totals.total_clicks or 0
    bounces = totals.total_bounces or 0

    return {
        "total_sent": sent,
        "total_opens": opens,
        "total_clicks": clicks,
        "total_bounces": bounces,
        "open_rate": round(opens / sent * 100, 2) if sent > 0 else 0,
        "click_rate": round(clicks / sent * 100, 2) if sent > 0 else 0,
        "bounce_rate": round(bounces / sent * 100, 2) if sent > 0 else 0,
        "delivery_rate": round((sent - bounces) / sent * 100, 2) if sent > 0 else 0,
        "smtp_count": smtp_count,
        "active_smtp": active_smtp,
        "campaign_count": campaign_count,
        "active_campaigns": active_campaigns,
        "queue_pending": queue_pending,
    }


@router.get("/campaigns/{campaign_id}")
def campaign_analytics(campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.owner_id == current_user.id).first()
    if not campaign:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Campaign not found")

    analytics = db.query(Analytics).filter(Analytics.campaign_id == campaign_id).first()
    if not analytics:
        return {"sent": 0, "opens": 0, "clicks": 0, "bounces": 0}

    sent = analytics.sent or 1
    return {
        "sent": analytics.sent,
        "delivered": analytics.delivered,
        "opens": analytics.opens,
        "unique_opens": analytics.unique_opens,
        "clicks": analytics.clicks,
        "unique_clicks": analytics.unique_clicks,
        "bounces": analytics.bounces,
        "complaints": analytics.complaints,
        "unsubscribes": analytics.unsubscribes,
        "open_rate": round(analytics.opens / sent * 100, 2),
        "click_rate": round(analytics.clicks / sent * 100, 2),
        "bounce_rate": round(analytics.bounces / sent * 100, 2),
    }


@router.get("/timeline")
def analytics_timeline(days: int = 30, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return last N days of sent email counts for charts."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    user_campaigns = db.query(Campaign.id).filter(Campaign.owner_id == current_user.id).subquery()

    rows = (
        db.query(
            func.date(SendLog.sent_at).label("date"),
            func.count(SendLog.id).label("count"),
        )
        .filter(
            SendLog.campaign_id.in_(user_campaigns),
            SendLog.sent_at >= since,
            SendLog.status == "sent",
        )
        .group_by(func.date(SendLog.sent_at))
        .order_by(func.date(SendLog.sent_at))
        .all()
    )
    return [{"date": str(r.date), "sent": r.count} for r in rows]
