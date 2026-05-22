# KURO FUNNELS

A production-ready fullstack SaaS application for **email infrastructure management**, **SMTP rotation**, and **campaign automation**.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + TailwindCSS + Recharts |
| Backend | FastAPI + SQLAlchemy + Pydantic |
| Database | PostgreSQL 16 |
| Queue | Redis + Celery + Celery Beat |
| Auth | JWT (access + refresh tokens) |
| Reverse Proxy | Nginx |
| Deploy | Docker + Docker Compose |

---

## Project Structure

```
kuro-funnels/
├── app/                    # React frontend
│   ├── src/
│   │   ├── pages/          # Login, Register, Dashboard, SMTP, Campaigns, Contacts, Analytics, Queue, Settings
│   │   ├── components/     # Sidebar, Header, StatsCard, Modal, Badge, etc.
│   │   ├── layouts/        # DashboardLayout
│   │   ├── store/          # Zustand stores (auth, app)
│   │   └── services/       # Axios API service layer
│   ├── Dockerfile
│   └── package.json
├── backend/                # FastAPI backend
│   ├── app/
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic request/response schemas
│   │   ├── routers/        # API route handlers
│   │   ├── services/       # Business logic (SMTP rotation, email sender)
│   │   ├── workers/        # Celery tasks
│   │   └── auth/           # JWT + bcrypt auth
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── nginx/
│   └── nginx.conf          # Reverse proxy config
├── docker-compose.yml
└── .env.example
```

---

## Quick Start

### Development (local)

> All commands assume you start from the **project root**: `cd /Users/zogha/Downloads/kuro-funnels`

**Terminal 1 — Backend API**

```bash
# From project root:
source .venv/bin/activate          # .venv is at the root, not inside backend/
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
cd backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Celery worker** (optional, needed for campaign sending)

```bash
# From project root:
source .venv/bin/activate
cd backend
celery -A app.workers.celery_app worker --loglevel=info
```

**Terminal 3 — Frontend**

```bash
# From project root:
cd app
npm run dev   # Runs at http://localhost:3000
```

---

### Production (Docker)

```bash
cp .env.example .env
# Edit SECRET_KEY and other secrets in .env

docker-compose up -d --build
```

Services started:
- `http://localhost` — Full app (Nginx reverse proxy)
- `http://localhost:8000` — Backend API
- `http://localhost:3000` — Frontend
- `http://localhost:5555` — Flower (Celery monitor)

**First user:** Register at `/register` — the first user gets standard access. To make admin, run:
```bash
docker-compose exec db psql -U kuro kurofunnels -c "UPDATE users SET role='admin' WHERE email='your@email.com';"
```

---

## API Routes

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login → tokens |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Current user |
| GET | `/smtp/` | List SMTP servers |
| POST | `/smtp/` | Add SMTP |
| POST | `/smtp/{id}/test` | Test connection |
| PATCH | `/smtp/{id}/toggle` | Active/pause |
| GET | `/campaigns/` | List campaigns |
| POST | `/campaigns/` | Create campaign |
| POST | `/campaigns/{id}/send` | Dispatch campaign |
| POST | `/campaigns/{id}/pause` | Pause sending |
| POST | `/campaigns/{id}/test-email` | Send test email |
| GET | `/contacts/lists` | Contact lists |
| POST | `/contacts/lists/{id}/import` | Import CSV |
| GET | `/analytics/dashboard` | Dashboard stats |
| GET | `/analytics/timeline` | Email timeline |
| GET | `/analytics/track/open/{id}` | Open pixel tracker |
| GET | `/queue/stats` | Queue overview |
| POST | `/queue/retry-failed` | Retry failed sends |

API docs: `http://localhost:8000/docs`

---

## Features

### SMTP Rotation Engine
- **Weighted round-robin**: `smtp_index = email_index % smtp_count`
- **Failover**: Automatically marks failing SMTPs, sets cooldown, reduces reputation score
- **Health monitoring**: Per-SMTP reputation score (0–100), tested-at timestamp, last error
- **Dynamic rate limiting**: Hourly and daily send limits per server

### Campaign System
- HTML editor with open/click tracking
- Schedule campaigns for future sending
- Pause/resume mid-send
- Test email before launch
- Per-campaign analytics

### Queue (Celery + Redis)
- Async email dispatch via Celery workers
- Auto-retry on failure (max 3 attempts)
- Celery Beat for scheduled campaigns (checks every 60s)
- Queue monitor dashboard with real-time auto-refresh

### Analytics
- Open/click tracking via pixel and redirect
- Per-campaign breakdown
- 30/14/7-day timeline charts
- Delivery, bounce, complaint, unsubscribe rates

---

## Database Schema

```
users          → id, email, username, hashed_password, role, is_active
smtps          → id, owner_id, host, port, username, password, status, reputation_score, limits
smtp_stats     → id, smtp_id, date, sent_count, failed_count
campaigns      → id, owner_id, name, subject, html_content, status, scheduled_at
contact_lists  → id, owner_id, name
contacts       → id, contact_list_id, email, first_name, last_name, is_subscribed
email_queue    → id, campaign_id, contact_id, smtp_id, status, retry_count
send_logs      → id, campaign_id, smtp_id, email, status, tracking_id, opened_at, clicked_at
analytics      → id, campaign_id, sent, opens, clicks, bounces, complaints
unsubscribes   → id, email, campaign_id
```

---

## Security

- Passwords hashed with bcrypt
- JWT with short-lived access tokens (60 min) + long-lived refresh tokens (30 days)
- CORS restricted to configured frontend origin
- Rate limiting on auth endpoints via `slowapi`
- All routes protected; admin routes require `role=admin`
- SQL injection protection via SQLAlchemy ORM
- Input validation via Pydantic

---

Crafted by **Kuro X** — production-grade email infrastructure in a box.
