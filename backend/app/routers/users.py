from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.user import User
from ..schemas.user import UserOut, UserUpdate
from ..auth.dependencies import get_current_user, get_admin_user
from ..auth.jwt import get_password_hash

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserOut)
def update_profile(payload: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me/password")
def change_password(
    current_password: str,
    new_password: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..auth.jwt import verify_password
    if not verify_password(current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password incorrect")
    current_user.hashed_password = get_password_hash(new_password)
    db.commit()
    return {"message": "Password updated"}


# Admin-only routes
@router.get("/", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    return db.query(User).all()


@router.patch("/{user_id}/toggle")
def toggle_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}
