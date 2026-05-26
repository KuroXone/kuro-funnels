import uuid
from datetime import datetime, timezone
from celery import shared_task
from sqlalchemy.orm import Session
from .celery_app import celery_app
from ..database import SessionLocal
from ..models.analytics import EmailQueue, SendLog, Analytics
from ..models.campaign import Campaign, CampaignStatus
from ..models.contact import Contact
from ..models.domain import Domain
from ..models.smtp import SMTPServer, SMTPStats
from ..services.email import send_email_via_smtp
from ..services.smtp_rotation import smtp_rotator
from ..services.warmup_service import advance_warmup, should_advance_day


def get_db() -> Session:
    return SessionLocal()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=300)
def send_single_email(self, queue_item_id: int):
    """Send a single queued email with SMTP rotation and retry logic."""
    db = get_db()
    try:
        item = db.query(EmailQueue).filter(EmailQueue.id == queue_item_id).first()
        if not item or item.status in ("sent", "failed"):
            return

        item.status = "processing"
        item.celery_task_id = self.request.id
        db.commit()

        campaign = db.query(Campaign).filter(Campaign.id == item.campaign_id).first()
        if not campaign:
            item.status = "failed"
            item.error_message = "Campaign not found"
            db.commit()
            return

        # Resolve contact email via explicit query (relationship may not be loaded)
        contact = db.query(Contact).filter(Contact.id == item.contact_id).first()
        if not contact:
            item.status = "failed"
            item.error_message = "Contact not found"
            db.commit()
            return

        smtp = smtp_rotator.select_smtp(db, campaign.owner_id, queue_item_id)
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
            html_content=campaign.html_content or "",
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

            analytics = db.query(Analytics).filter(Analytics.campaign_id == campaign.id).first()
            if analytics:
                analytics.sent = (analytics.sent or 0) + 1
                analytics.delivered = (analytics.delivered or 0) + 1

            smtp_rotator.mark_success(db, smtp)
            db.add(SMTPStats(smtp_id=smtp.id, sent_count=1))

            # Track warmup send count for the sending domain
            if campaign.from_email and "@" in campaign.from_email:
                sending_domain = campaign.from_email.split("@")[1].lower()
                domain_obj = (
                    db.query(Domain)
                    .filter(Domain.domain == sending_domain, Domain.owner_id == campaign.owner_id)
                    .first()
                )
                if domain_obj and domain_obj.warmup_enabled:
                    domain_obj.warmup_sent_today = (domain_obj.warmup_sent_today or 0) + 1

        else:
            item.retry_count = (item.retry_count or 0) + 1
            item.error_message = result.get("error", "Unknown error")[:500]
            if item.retry_count >= (item.max_retries or 3):
                item.status = "failed"
                smtp_rotator.mark_failed(db, smtp, item.error_message)
            else:
                item.status = "retry"
                raise self.retry(exc=Exception(result.get("error")))

        db.commit()
    finally:
        db.close()


@celery_app.task
def dispatch_campaign(campaign_id: int):
    """Enqueue all emails for a campaign and kick off Celery tasks."""
    db = get_db()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            return

        campaign.status = CampaignStatus.sending
        campaign.started_at = datetime.now(timezone.utc)
        db.commit()

        existing = db.query(Analytics).filter(Analytics.campaign_id == campaign_id).first()
        if not existing:
            db.add(Analytics(campaign_id=campaign_id))
            db.commit()

        queue_items = (
            db.query(EmailQueue)
            .filter(EmailQueue.campaign_id == campaign_id, EmailQueue.status == "pending")
            .all()
        )

        for idx, item in enumerate(queue_items):
            send_single_email.apply_async(args=[item.id], countdown=idx * 0.1)

        campaign.total_recipients = len(queue_items)
        db.commit()
    finally:
        db.close()


@celery_app.task
def check_scheduled_campaigns():
    """Celerybeat task: launch campaigns whose scheduled_at has passed."""
    db = get_db()
    try:
        now = datetime.now(timezone.utc)
        campaigns = (
            db.query(Campaign)
            .filter(
                Campaign.status == CampaignStatus.scheduled,
                Campaign.scheduled_at <= now,
            )
            .all()
        )
        for campaign in campaigns:
            dispatch_campaign.delay(campaign.id)
    finally:
        db.close()


@celery_app.task
def cleanup_old_queue_items():
    """Remove processed queue items older than 7 days."""
    from datetime import timedelta
    db = get_db()
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        db.query(EmailQueue).filter(
            EmailQueue.status.in_(["sent", "failed"]),
            EmailQueue.processed_at < cutoff,
        ).delete()
        db.commit()
    finally:
        db.close()


@celery_app.task
def advance_warmup_domains():
    """Advance warmup day for all eligible domains (runs hourly via beat)."""
    db = get_db()
    try:
        domains = (
            db.query(Domain)
            .filter(Domain.warmup_enabled == True)
            .all()
        )
        advanced = 0
        for domain_obj in domains:
            if should_advance_day(domain_obj.warmup_last_advanced):
                if advance_warmup(domain_obj):
                    advanced += 1
        if advanced:
            db.commit()
        return {"advanced": advanced}
    finally:
        db.close()


@celery_app.task
def auto_verify_domains():
    """Re-check DNS for all pending/partial domains every 5 minutes (beat schedule)."""
    from ..routers.domains import run_dns_verification
    db = get_db()
    try:
        domains = (
            db.query(Domain)
            .filter(Domain.status.in_(["pending", "partial"]))
            .all()
        )
        checked = 0
        now = datetime.now(timezone.utc)
        for domain_obj in domains:
            try:
                run_dns_verification(db, domain_obj, now)
                checked += 1
            except Exception:
                pass
        db.commit()
        return {"checked": checked}
    finally:
        db.close()
