from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from ..database import get_db
from ..models.domain import Domain
from ..models.user import User
from ..schemas.domain import WarmupProgress
from ..auth.dependencies import get_current_user
from ..services.warmup_service import (
    get_daily_limit, get_schedule_display, warmup_progress_pct,
    advance_warmup, is_warmup_complete, WARMUP_SCHEDULE,
)

router = APIRouter(prefix="/warmup", tags=["warmup"])


@router.get("/schedule")
def get_schedule():
    """Return the full warmup schedule."""
    return {"schedule": get_schedule_display(), "total_days": len(WARMUP_SCHEDULE)}


@router.get("/", response_model=List[WarmupProgress])
def list_warmup(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domains = db.query(Domain).filter(Domain.owner_id == current_user.id).all()
    result = []
    for d in domains:
        result.append(WarmupProgress(
            domain_id=d.id,
            domain=d.domain,
            warmup_enabled=d.warmup_enabled,
            current_day=d.warmup_day,
            daily_limit=d.warmup_daily_limit,
            sent_today=d.warmup_sent_today or 0,
            schedule=get_schedule_display(),
            pct_complete=warmup_progress_pct(d.warmup_day),
        ))
    return result


@router.post("/{domain_id}/enable")
def enable_warmup(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    domain.warmup_enabled = True
    if domain.warmup_day == 0:
        domain.warmup_day = 1
        domain.warmup_daily_limit = get_daily_limit(1)
        domain.warmup_last_advanced = datetime.now(timezone.utc)
    db.commit()
    return {"message": f"Warmup enabled for {domain.domain}", "daily_limit": domain.warmup_daily_limit}


@router.post("/{domain_id}/disable")
def disable_warmup(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    domain.warmup_enabled = False
    db.commit()
    return {"message": f"Warmup disabled for {domain.domain}"}


@router.post("/{domain_id}/advance")
def advance_day(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually advance warmup by one day (for testing / manual override)."""
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    if is_warmup_complete(domain.warmup_day):
        return {"message": "Warmup already complete", "warmup_day": domain.warmup_day}

    domain.warmup_day = min(domain.warmup_day + 1, len(WARMUP_SCHEDULE))
    domain.warmup_daily_limit = get_daily_limit(domain.warmup_day)
    domain.warmup_sent_today = 0
    domain.warmup_last_advanced = datetime.now(timezone.utc)
    db.commit()

    return {
        "message": f"Advanced to day {domain.warmup_day}",
        "warmup_day": domain.warmup_day,
        "daily_limit": domain.warmup_daily_limit,
    }


@router.get("/{domain_id}/progress")
def get_progress(
    domain_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    domain = db.query(Domain).filter(Domain.id == domain_id, Domain.owner_id == current_user.id).first()
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    return {
        "domain": domain.domain,
        "warmup_enabled": domain.warmup_enabled,
        "warmup_day": domain.warmup_day,
        "daily_limit": domain.warmup_daily_limit,
        "sent_today": domain.warmup_sent_today or 0,
        "pct_complete": warmup_progress_pct(domain.warmup_day),
        "is_complete": is_warmup_complete(domain.warmup_day),
        "schedule": get_schedule_display(),
    }
