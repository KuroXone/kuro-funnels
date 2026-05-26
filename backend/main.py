import asyncio
import json
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import Base, engine, get_db
from app.routers import auth, smtp, campaigns, contacts, analytics, queue, users
from app.routers import templates, domains, warmup, smtp_health
from app.models.analytics import EmailQueue
from app.models.campaign import Campaign
from app.models.domain import Domain
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.config import settings

# Create all tables on startup
Base.metadata.create_all(bind=engine)

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="KuroFunnels API",
    description="Email infrastructure & campaign management system",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_allowed_origins = list({
    "http://localhost:5173",   # Vite dev server
    "http://localhost:5174",   # Vite fallback port
    "http://localhost:80",     # nginx (Docker)
    "http://localhost",        # nginx (Docker, default port)
    settings.FRONTEND_URL,
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all routers
app.include_router(auth.router)
app.include_router(smtp.router)
app.include_router(campaigns.router)
app.include_router(contacts.router)
app.include_router(analytics.router)
app.include_router(queue.router)
app.include_router(users.router)
app.include_router(templates.router)
app.include_router(domains.router)
app.include_router(warmup.router)
app.include_router(smtp_health.router)


@app.get("/health")
def health_check():
    return {"status": "healthy", "app": settings.APP_NAME, "version": "2.0.0"}


@app.get("/")
def root():
    return {"status": "running", "version": "2.0.0", "docs": "/docs"}


# ── Server-Sent Events: live queue stats stream ──────────────────────────────

async def queue_stats_generator(db: Session, user: User):
    """Yield queue stat snapshots every 3 seconds over SSE."""
    try:
        while True:
            user_campaigns = db.query(Campaign.id).filter(Campaign.owner_id == user.id).subquery()
            rows = (
                db.query(EmailQueue.status, func.count(EmailQueue.id).label("count"))
                .filter(EmailQueue.campaign_id.in_(user_campaigns))
                .group_by(EmailQueue.status)
                .all()
            )
            stats = {s: 0 for s in ("pending", "processing", "sent", "failed", "retry")}
            for row in rows:
                stats[row.status] = row.count
            yield f"data: {json.dumps(stats)}\n\n"
            await asyncio.sleep(3)
    except asyncio.CancelledError:
        pass


@app.get("/queue/stream")
async def queue_stream(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SSE endpoint — streams queue stats every 3s to the frontend."""
    return StreamingResponse(
        queue_stats_generator(db, current_user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
