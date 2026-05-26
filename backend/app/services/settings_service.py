"""
Runtime key-value settings stored in the database.
Used for secrets that should be configurable via the UI (e.g. CF OAuth credentials).
Falls back to environment/.env values when a DB value is absent.
"""
from typing import Optional
from sqlalchemy.orm import Session

from ..models.domain import AppSettings
from .cloudflare_oauth_service import encrypt, decrypt


def get_setting(db: Session, key: str) -> Optional[str]:
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    if not row or not row.value:
        return None
    if row.encrypted:
        try:
            return decrypt(row.value)
        except Exception:
            return None
    return row.value


def set_setting(db: Session, key: str, value: str, encrypted: bool = False) -> None:
    stored = encrypt(value) if encrypted else value
    row = db.query(AppSettings).filter(AppSettings.key == key).first()
    if row:
        row.value = stored
        row.encrypted = encrypted
    else:
        db.add(AppSettings(key=key, value=stored, encrypted=encrypted))
    db.commit()
