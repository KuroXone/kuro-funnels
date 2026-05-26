from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models.analytics import EmailQueue
from ..models.campaign import Campaign
from ..models.user import User
from ..auth.dependencies import get_current_user

router = APIRouter(prefix="/queue", tags=["queue"])


@router.get("/stats")
def queue_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_campaigns = db.query(Campaign.id).filter(Campaign.owner_id == current_user.id).subquery()

    stats = (
        db.query(EmailQueue.status, func.count(EmailQueue.id).label("count"))
        .filter(EmailQueue.campaign_id.in_(user_campaigns))
        .group_by(EmailQueue.status)
        .all()
    )
    result = {s: 0 for s in ("pending", "processing", "sent", "failed", "retry")}
    for row in stats:
        result[row.status] = row.count
    return result


@router.get("/items")
def list_queue_items(
    campaign_id: int = None,
    status: str = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user_campaigns = db.query(Campaign.id).filter(Campaign.owner_id == current_user.id).subquery()
    q = db.query(EmailQueue).filter(EmailQueue.campaign_id.in_(user_campaigns))
    if campaign_id:
        q = q.filter(EmailQueue.campaign_id == campaign_id)
    if status:
        q = q.filter(EmailQueue.status == status)
    items = q.order_by(EmailQueue.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": item.id,
            "campaign_id": item.campaign_id,
            "status": item.status,
            "retry_count": item.retry_count,
            "created_at": item.created_at,
            "processed_at": item.processed_at,
            "error_message": item.error_message,
        }
        for item in items
    ]


@router.post("/retry-failed")
def retry_failed(campaign_id: int = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_campaigns = db.query(Campaign.id).filter(Campaign.owner_id == current_user.id).subquery()
    q = db.query(EmailQueue).filter(
        EmailQueue.campaign_id.in_(user_campaigns),
        EmailQueue.status == "failed",
    )
    if campaign_id:
        q = q.filter(EmailQueue.campaign_id == campaign_id)

    items = q.all()
    from ..workers.tasks import send_single_email
    queued = 0
    for item in items:
        item.status = "pending"
        item.retry_count = 0
        db.commit()
        try:
            send_single_email.delay(item.id)
        except Exception:
            # Redis/Celery unavailable — run synchronously as fallback
            send_single_email(item.id)
        queued += 1

    return {"queued": queued}
