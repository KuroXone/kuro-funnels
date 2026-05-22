"""
SMTP rotation engine.
Strategies: round_robin, weighted, reputation_based, random.
Includes automatic failover and cooldown management.
"""
import random
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from ..models.smtp import SMTPServer, SMTPStatus


class SMTPRotationEngine:

    def get_active_smtps(self, db: Session, owner_id: int) -> List[SMTPServer]:
        now = datetime.now(timezone.utc)
        return (
            db.query(SMTPServer)
            .filter(
                SMTPServer.owner_id == owner_id,
                SMTPServer.status == SMTPStatus.active,
                (SMTPServer.cooldown_until == None) | (SMTPServer.cooldown_until < now),
            )
            .order_by(SMTPServer.weight.desc())
            .all()
        )

    def round_robin(self, smtps: List[SMTPServer], email_index: int) -> Optional[SMTPServer]:
        if not smtps:
            return None
        return smtps[email_index % len(smtps)]

    def weighted_round_robin(self, smtps: List[SMTPServer], email_index: int) -> Optional[SMTPServer]:
        if not smtps:
            return None
        pool = []
        for smtp in smtps:
            pool.extend([smtp] * max(1, smtp.weight))
        return pool[email_index % len(pool)]

    def reputation_based(self, smtps: List[SMTPServer]) -> Optional[SMTPServer]:
        """Select the SMTP with the highest reputation score."""
        if not smtps:
            return None
        return max(smtps, key=lambda s: s.reputation_score or 0)

    def random_selection(self, smtps: List[SMTPServer]) -> Optional[SMTPServer]:
        if not smtps:
            return None
        weights = [max(1, int(s.reputation_score or 50)) * max(1, s.weight) for s in smtps]
        return random.choices(smtps, weights=weights, k=1)[0]

    def select_smtp(
        self,
        db: Session,
        owner_id: int,
        email_index: int = 0,
        strategy: str = "weighted",
    ) -> Optional[SMTPServer]:
        smtps = self.get_active_smtps(db, owner_id)
        if not smtps:
            return None

        if strategy == "round_robin":
            return self.round_robin(smtps, email_index)
        if strategy == "reputation":
            return self.reputation_based(smtps)
        if strategy == "random":
            return self.random_selection(smtps)
        return self.weighted_round_robin(smtps, email_index)

    def mark_failed(self, db: Session, smtp: SMTPServer, error: str, cooldown_minutes: int = 30):
        smtp.last_error = error
        smtp.reputation_score = max(0, (smtp.reputation_score or 100) - 10)
        if smtp.reputation_score < 20:
            smtp.status = SMTPStatus.error
            smtp.last_error = f"Auto-paused (reputation critical): {error}"
        else:
            smtp.cooldown_until = datetime.now(timezone.utc) + timedelta(minutes=cooldown_minutes)
        db.commit()

    def mark_success(self, db: Session, smtp: SMTPServer):
        smtp.reputation_score = min(100, (smtp.reputation_score or 100) + 0.1)
        smtp.last_error = None
        smtp.cooldown_until = None
        db.commit()

    def get_rotation_stats(self, db: Session, owner_id: int) -> dict:
        all_smtps = db.query(SMTPServer).filter(SMTPServer.owner_id == owner_id).all()
        active = self.get_active_smtps(db, owner_id)
        return {
            "total": len(all_smtps),
            "active_in_pool": len(active),
            "pool": [{"id": s.id, "name": s.name, "weight": s.weight, "reputation": s.reputation_score} for s in active],
        }


smtp_rotator = SMTPRotationEngine()
