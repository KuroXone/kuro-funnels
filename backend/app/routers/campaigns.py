from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from ..database import get_db
from ..models.campaign import Campaign, CampaignStatus
from ..models.analytics import EmailQueue, Analytics
from ..models.contact import Contact
from ..models.smtp import SMTPServer
from ..models.user import User
from ..schemas.campaign import CampaignCreate, CampaignUpdate, CampaignOut, TestEmailRequest
from ..auth.dependencies import get_current_user
from ..services.smtp_rotation import smtp_rotator
from ..services.email import send_email_via_smtp
from ..services.campaign_sender import send_campaign_inline

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("/", response_model=List[CampaignOut])
def list_campaigns(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Campaign).filter(Campaign.owner_id == current_user.id).order_by(Campaign.created_at.desc()).all()


@router.post("/", response_model=CampaignOut, status_code=201)
def create_campaign(payload: CampaignCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = Campaign(**payload.model_dump(), owner_id=current_user.id)
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}", response_model=CampaignOut)
def get_campaign(campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.owner_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.put("/{campaign_id}", response_model=CampaignOut)
def update_campaign(campaign_id: int, payload: CampaignUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.owner_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status == CampaignStatus.sending:
        raise HTTPException(status_code=400, detail="Cannot edit a campaign that is currently sending")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.delete("/{campaign_id}", status_code=204)
def delete_campaign(campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.owner_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(campaign)
    db.commit()


@router.post("/{campaign_id}/send")
def send_campaign(
    campaign_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.owner_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status not in (CampaignStatus.draft, CampaignStatus.paused, CampaignStatus.failed):
        raise HTTPException(status_code=400, detail=f"Campaign is '{campaign.status}', cannot send")
    if not campaign.contact_list_id:
        raise HTTPException(status_code=400, detail="No contact list assigned to this campaign")

    # Check at least one active SMTP exists
    active_smtp = smtp_rotator.get_active_smtps(db, current_user.id)
    if not active_smtp:
        raise HTTPException(status_code=400, detail="No active SMTP servers configured. Add and activate an SMTP server first.")

    contacts = db.query(Contact).filter(
        Contact.contact_list_id == campaign.contact_list_id,
        Contact.is_subscribed == True,
        Contact.is_bounced == False,
    ).all()

    if not contacts:
        raise HTTPException(status_code=400, detail="No eligible contacts in the selected list")

    # Build queue (skip already-queued contacts)
    queued = 0
    for contact in contacts:
        existing = db.query(EmailQueue).filter(
            EmailQueue.campaign_id == campaign_id,
            EmailQueue.contact_id == contact.id,
            EmailQueue.status.in_(["pending", "processing", "sent"]),
        ).first()
        if not existing:
            db.add(EmailQueue(campaign_id=campaign_id, contact_id=contact.id))
            queued += 1

    db.commit()

    # Try Celery first; fall back to inline background task if Redis is unavailable
    celery_dispatched = False
    try:
        from ..workers.tasks import dispatch_campaign
        dispatch_campaign.delay(campaign_id)
        celery_dispatched = True
    except Exception:
        # Redis / broker not available — run inline in a BackgroundTask thread
        background_tasks.add_task(send_campaign_inline, campaign_id)

    return {
        "message": "Campaign dispatch started",
        "campaign_id": campaign_id,
        "queued": queued,
        "mode": "celery" if celery_dispatched else "inline",
    }


@router.post("/{campaign_id}/pause")
def pause_campaign(campaign_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.owner_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status != CampaignStatus.sending:
        raise HTTPException(status_code=400, detail="Only a sending campaign can be paused")
    campaign.status = CampaignStatus.paused
    db.commit()
    return {"message": "Campaign paused"}


@router.post("/{campaign_id}/test-email")
def send_test_email(
    campaign_id: int,
    payload: TestEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id, Campaign.owner_id == current_user.id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    if not campaign.html_content and not campaign.text_content:
        raise HTTPException(status_code=400, detail="Campaign has no content to send")

    # Prefer explicitly requested SMTP; fall back to rotation
    smtp = None
    if payload.smtp_id:
        smtp = db.query(SMTPServer).filter(
            SMTPServer.id == payload.smtp_id,
            SMTPServer.owner_id == current_user.id,
        ).first()
        if not smtp:
            raise HTTPException(status_code=404, detail=f"SMTP server {payload.smtp_id} not found")

    if not smtp:
        smtp = smtp_rotator.select_smtp(db, current_user.id, 0)

    if not smtp:
        raise HTTPException(
            status_code=400,
            detail="No active SMTP server available. Add and activate one in SMTP Manager.",
        )

    result = send_email_via_smtp(
        smtp_server=smtp,
        to_email=payload.to_email,
        subject=f"[TEST] {campaign.subject}",
        html_content=campaign.html_content or "<p>(No HTML content)</p>",
        from_name=campaign.from_name,
        from_email=campaign.from_email,
        text_content=campaign.text_content,
        reply_to=campaign.reply_to,
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Send failed"))

    return {
        "message": "Test email sent successfully",
        "to": payload.to_email,
        "smtp": smtp.name,
        "latency_ms": result.get("latency_ms"),
    }
