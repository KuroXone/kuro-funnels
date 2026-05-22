import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from ..database import get_db
from ..models.contact import ContactList, Contact, Unsubscribe
from ..models.user import User
from ..schemas.contact import ContactListCreate, ContactListOut, ContactCreate, ContactOut, ContactImportResult
from ..auth.dependencies import get_current_user

router = APIRouter(prefix="/contacts", tags=["contacts"])


def _count_contacts(db: Session, list_id: int) -> int:
    return db.query(func.count(Contact.id)).filter(Contact.contact_list_id == list_id).scalar() or 0


@router.get("/lists", response_model=List[ContactListOut])
def list_contact_lists(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lists = db.query(ContactList).filter(ContactList.owner_id == current_user.id).all()
    result = []
    for lst in lists:
        out = ContactListOut.model_validate(lst)
        out.contact_count = _count_contacts(db, lst.id)
        result.append(out)
    return result


@router.post("/lists", response_model=ContactListOut, status_code=201)
def create_contact_list(payload: ContactListCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lst = ContactList(**payload.model_dump(), owner_id=current_user.id)
    db.add(lst)
    db.commit()
    db.refresh(lst)
    out = ContactListOut.model_validate(lst)
    out.contact_count = 0
    return out


@router.delete("/lists/{list_id}", status_code=204)
def delete_contact_list(list_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lst = db.query(ContactList).filter(ContactList.id == list_id, ContactList.owner_id == current_user.id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    db.delete(lst)
    db.commit()


@router.get("/lists/{list_id}/contacts")
def list_contacts(
    list_id: int,
    search: Optional[str] = Query(None),
    subscribed_only: bool = Query(False),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lst = db.query(ContactList).filter(ContactList.id == list_id, ContactList.owner_id == current_user.id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    q = db.query(Contact).filter(Contact.contact_list_id == list_id)
    if search:
        q = q.filter(
            Contact.email.ilike(f"%{search}%")
            | Contact.first_name.ilike(f"%{search}%")
            | Contact.last_name.ilike(f"%{search}%")
        )
    if subscribed_only:
        q = q.filter(Contact.is_subscribed == True)
    total = q.count()
    items = q.offset(skip).limit(limit).all()
    return {"total": total, "items": [ContactOut.model_validate(c) for c in items]}


@router.post("/lists/{list_id}/contacts", response_model=ContactOut, status_code=201)
def add_contact(list_id: int, payload: ContactCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lst = db.query(ContactList).filter(ContactList.id == list_id, ContactList.owner_id == current_user.id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    existing = db.query(Contact).filter(Contact.email == payload.email, Contact.contact_list_id == list_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Contact with this email already exists in this list")
    contact = Contact(**payload.model_dump(), contact_list_id=list_id)
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.post("/lists/{list_id}/import", response_model=ContactImportResult)
async def import_contacts(list_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lst = db.query(ContactList).filter(ContactList.id == list_id, ContactList.owner_id == current_user.id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    imported = skipped = errors = 0
    batch = []

    for row in reader:
        email = (row.get("email") or row.get("Email") or row.get("EMAIL") or "").strip()
        if not email or "@" not in email:
            errors += 1
            continue
        existing = db.query(Contact).filter(Contact.email == email, Contact.contact_list_id == list_id).first()
        if existing:
            skipped += 1
            continue
        batch.append(Contact(
            email=email,
            first_name=(row.get("first_name") or row.get("First Name") or row.get("firstname") or "").strip(),
            last_name=(row.get("last_name") or row.get("Last Name") or row.get("lastname") or "").strip(),
            contact_list_id=list_id,
        ))
        imported += 1
        if len(batch) >= 500:
            db.bulk_save_objects(batch)
            db.commit()
            batch = []

    if batch:
        db.bulk_save_objects(batch)
        db.commit()

    return ContactImportResult(imported=imported, skipped=skipped, errors=errors, total=imported + skipped + errors)


@router.delete("/lists/{list_id}/contacts/{contact_id}", status_code=204)
def delete_contact(list_id: int, contact_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lst = db.query(ContactList).filter(ContactList.id == list_id, ContactList.owner_id == current_user.id).first()
    if not lst:
        raise HTTPException(status_code=404, detail="List not found")
    contact = db.query(Contact).filter(Contact.id == contact_id, Contact.contact_list_id == list_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()


@router.post("/unsubscribe/{email}")
def unsubscribe(email: str, db: Session = Depends(get_db)):
    db.query(Contact).filter(Contact.email == email).update({"is_subscribed": False})
    existing = db.query(Unsubscribe).filter(Unsubscribe.email == email).first()
    if not existing:
        db.add(Unsubscribe(email=email))
    db.commit()
    return {"message": "Unsubscribed successfully"}


@router.get("/suppression/list")
def suppression_list(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    items = db.query(Unsubscribe).order_by(Unsubscribe.created_at.desc()).limit(500).all()
    return [{"email": i.email, "created_at": i.created_at} for i in items]
