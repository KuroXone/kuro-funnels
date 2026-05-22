from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db
from ..models.template import EmailTemplate
from ..models.user import User
from ..schemas.template import TemplateCreate, TemplateUpdate, TemplateOut
from ..auth.dependencies import get_current_user

router = APIRouter(prefix="/templates", tags=["templates"])

DEFAULT_TEMPLATES = [
    {
        "name": "Welcome Email",
        "subject": "Welcome to {{company_name}}!",
        "category": "onboarding",
        "html_content": """<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        <tr><td style="background:linear-gradient(135deg,#6d28d9,#4f46e5);padding:40px;text-align:center;">
          <h1 style="color:#fff;font-size:28px;margin:0;font-weight:700">Welcome, {{first_name}}! 🎉</h1>
          <p style="color:#c4b5fd;margin:12px 0 0;font-size:16px">We're thrilled to have you on board.</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <p style="color:#94a3b8;font-size:16px;line-height:1.6;margin:0 0 24px">Hi {{first_name}},</p>
          <p style="color:#94a3b8;font-size:16px;line-height:1.6;margin:0 0 24px">Your account is ready. Start exploring everything we have to offer.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="{{cta_url}}" style="background:linear-gradient(135deg,#6d28d9,#4f46e5);color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">Get Started →</a>
          </div>
        </td></tr>
        <tr><td style="border-top:1px solid #334155;padding:24px 40px;text-align:center;">
          <p style="color:#475569;font-size:13px;margin:0">© {{company_name}} · <a href="{{unsubscribe_url}}" style="color:#6d28d9">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>""",
    },
    {
        "name": "Newsletter",
        "subject": "{{month}} Newsletter — {{headline}}",
        "category": "newsletter",
        "html_content": """<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        <tr><td style="padding:32px 40px;border-bottom:1px solid #334155;">
          <h2 style="color:#f1f5f9;margin:0;font-size:22px">{{company_name}}</h2>
          <p style="color:#64748b;margin:4px 0 0;font-size:13px">{{month}} Newsletter</p>
        </td></tr>
        <tr><td style="padding:40px;">
          <h1 style="color:#f1f5f9;font-size:26px;margin:0 0 16px;line-height:1.3">{{headline}}</h1>
          <p style="color:#94a3b8;font-size:16px;line-height:1.7;margin:0 0 24px">{{body_text}}</p>
          <div style="background:#0f172a;border-radius:10px;padding:24px;margin:24px 0;border:1px solid #334155;">
            <h3 style="color:#a78bfa;margin:0 0 8px;font-size:15px">✨ Featured Update</h3>
            <p style="color:#94a3b8;margin:0;font-size:14px;line-height:1.6">{{feature_text}}</p>
          </div>
          <div style="text-align:center;margin-top:32px;">
            <a href="{{cta_url}}" style="background:#6d28d9;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block;">{{cta_text}}</a>
          </div>
        </td></tr>
        <tr><td style="border-top:1px solid #334155;padding:24px 40px;text-align:center;">
          <p style="color:#475569;font-size:13px;margin:0">© {{company_name}} · <a href="{{unsubscribe_url}}" style="color:#6d28d9">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>""",
    },
    {
        "name": "Promotional",
        "subject": "🔥 {{discount}}% OFF — Limited Time Offer",
        "category": "promotional",
        "html_content": """<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        <tr><td style="background:linear-gradient(135deg,#dc2626,#f59e0b);padding:50px;text-align:center;">
          <p style="color:rgba(255,255,255,0.8);margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:2px">Limited Time Offer</p>
          <h1 style="color:#fff;font-size:64px;font-weight:900;margin:0;line-height:1">{{discount}}%</h1>
          <p style="color:rgba(255,255,255,0.9);font-size:20px;margin:8px 0 0;font-weight:600">OFF {{product_name}}</p>
        </td></tr>
        <tr><td style="padding:40px;text-align:center;">
          <p style="color:#94a3b8;font-size:16px;line-height:1.6;margin:0 0 8px">Hi {{first_name}}, your exclusive offer expires in:</p>
          <p style="color:#f59e0b;font-size:22px;font-weight:700;margin:0 0 32px">{{expires_in}}</p>
          <div style="background:#0f172a;border-radius:10px;padding:20px;margin:0 0 32px;border:2px dashed #6d28d9;">
            <p style="color:#94a3b8;font-size:13px;margin:0 0 8px">Use code at checkout:</p>
            <p style="color:#a78bfa;font-size:28px;font-weight:700;margin:0;letter-spacing:4px">{{promo_code}}</p>
          </div>
          <a href="{{cta_url}}" style="background:linear-gradient(135deg,#dc2626,#f59e0b);color:#fff;padding:16px 40px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">Claim Offer Now</a>
        </td></tr>
        <tr><td style="border-top:1px solid #334155;padding:24px 40px;text-align:center;">
          <p style="color:#475569;font-size:13px;margin:0">© {{company_name}} · <a href="{{unsubscribe_url}}" style="color:#6d28d9">Unsubscribe</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>""",
    },
]


@router.get("/", response_model=List[TemplateOut])
def list_templates(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(EmailTemplate).filter(EmailTemplate.owner_id == current_user.id)
    if category:
        q = q.filter(EmailTemplate.category == category)
    if search:
        q = q.filter(
            EmailTemplate.name.ilike(f"%{search}%") | EmailTemplate.subject.ilike(f"%{search}%")
        )
    return q.order_by(EmailTemplate.created_at.desc()).all()


@router.post("/", response_model=TemplateOut, status_code=201)
def create_template(payload: TemplateCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tpl = EmailTemplate(**payload.model_dump(), owner_id=current_user.id)
    db.add(tpl)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(template_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tpl = db.query(EmailTemplate).filter(EmailTemplate.id == template_id, EmailTemplate.owner_id == current_user.id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@router.put("/{template_id}", response_model=TemplateOut)
def update_template(template_id: int, payload: TemplateUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tpl = db.query(EmailTemplate).filter(EmailTemplate.id == template_id, EmailTemplate.owner_id == current_user.id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tpl, field, value)
    db.commit()
    db.refresh(tpl)
    return tpl


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tpl = db.query(EmailTemplate).filter(EmailTemplate.id == template_id, EmailTemplate.owner_id == current_user.id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(tpl)
    db.commit()


@router.post("/seed-defaults", status_code=201)
def seed_default_templates(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Create the 3 built-in starter templates for the current user."""
    created = 0
    for tpl_data in DEFAULT_TEMPLATES:
        exists = db.query(EmailTemplate).filter(
            EmailTemplate.owner_id == current_user.id,
            EmailTemplate.name == tpl_data["name"],
        ).first()
        if not exists:
            tpl = EmailTemplate(**tpl_data, owner_id=current_user.id, is_default=True)
            db.add(tpl)
            created += 1
    db.commit()
    return {"created": created, "message": f"{created} default templates added"}
