"""
Inline campaign sender — used when Celery/Redis is unavailable.
Runs inside a FastAPI BackgroundTask thread; no external broker needed.
"""
import uuid
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models.analytics import EmailQueue, SendLog, Analytics
from ..models.campaign import Campaign, CampaignStatus
from ..models.contact import Contact
from ..models.smtp import SMTPStats
from ..services.email import send_email_via_smtp
from ..services.smtp_rotation import smtp_rotator

logger = logging.getLogger(__name__)


def send_campaign_inline(campaign_id: int) -> None:
    """
    Send all pending queue items for a campaign without Celery.
    Safe to call from a BackgroundTask (runs in a thread, not the event loop).
    """
    db: Session = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            logger.error("Campaign %s not found", campaign_id)
            return

        campaign.status = CampaignStatus.sending
        campaign.started_at = datetime.now(timezone.utc)
        db.commit()

        # Ensure analytics row exists
        analytics = db.query(Analytics).filter(Analytics.campaign_id == campaign_id).first()
        if not analytics:
            analytics = Analytics(campaign_id=campaign_id)
            db.add(analytics)
            db.commit()

        queue_items = (
            db.query(EmailQueue)
            .filter(
                EmailQueue.campaign_id == campaign_id,
                EmailQueue.status == "pending",
            )
            .all()
        )

        campaign.total_recipients = len(queue_items)
        db.commit()

        if not queue_items:
            campaign.status = CampaignStatus.completed
            campaign.completed_at = datetime.now(timezone.utc)
            db.commit()
            return

        for idx, item in enumerate(queue_items):
            try:
                _process_item(db, item, campaign, analytics, idx)
            except Exception as exc:
                logger.error("Queue item %s failed unexpectedly: %s", item.id, exc)
                try:
                    item.status = "failed"
                    item.error_message = str(exc)[:500]
                    db.commit()
                except Exception:
                    db.rollback()

        campaign.status = CampaignStatus.completed
        campaign.completed_at = datetime.now(timezone.utc)
        db.commit()
        logger.info("Campaign %s completed inline", campaign_id)

    except Exception as exc:
        logger.error("Campaign %s inline send crashed: %s", campaign_id, exc)
        try:
            campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
            if campaign:
                campaign.status = CampaignStatus.failed
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def _process_item(
    db: Session,
    item: EmailQueue,
    campaign: Campaign,
    analytics: Analytics,
    idx: int,
) -> None:
    """Process one queued email — mark it in-progress, send, then record result."""
    item.status = "processing"
    db.commit()

    # Resolve recipient
    contact = db.query(Contact).filter(Contact.id == item.contact_id).first()
    if not contact:
        item.status = "failed"
        item.error_message = "Contact not found"
        db.commit()
        return

    # Pick SMTP server
    smtp = smtp_rotator.select_smtp(db, campaign.owner_id, idx)
    if not smtp:
        item.status = "failed"
        item.error_message = "No active SMTP servers available"
        db.commit()
        return

    tracking_id = str(uuid.uuid4())
    result = send_email_via_smtp(
        smtp_server=smtp,
        to_email=contact.email,
        subject=campaign.subject,
        html_content=campaign.html_content or "<p></p>",
        from_name=campaign.from_name,
        from_email=campaign.from_email,
        text_content=campaign.text_content,
        reply_to=campaign.reply_to,
        tracking_id=tracking_id,
    )

    now = datetime.now(timezone.utc)

    if result["success"]:
        item.status = "sent"
        item.processed_at = now
        item.smtp_id = smtp.id

        db.add(SendLog(
            campaign_id=campaign.id,
            smtp_id=smtp.id,
            email=contact.email,
            status="sent",
            sent_at=now,
            tracking_id=tracking_id,
        ))

        analytics.sent = (analytics.sent or 0) + 1
        analytics.delivered = (analytics.delivered or 0) + 1

        smtp_rotator.mark_success(db, smtp)
        db.add(SMTPStats(smtp_id=smtp.id, sent_count=1))

    else:
        item.retry_count = (item.retry_count or 0) + 1
        item.error_message = result.get("error", "Unknown error")[:500]

        if item.retry_count >= (item.max_retries or 3):
            item.status = "failed"
            smtp_rotator.mark_failed(db, smtp, item.error_message)
        else:
            item.status = "retry"

    db.commit()
