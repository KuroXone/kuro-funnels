from celery import Celery
from ..config import settings

celery_app = Celery(
    "kuro_funnels",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "check-scheduled-campaigns": {
            "task": "app.workers.tasks.check_scheduled_campaigns",
            "schedule": 60.0,  # every minute
        },
        "cleanup-old-queue": {
            "task": "app.workers.tasks.cleanup_old_queue_items",
            "schedule": 3600.0,  # every hour
        },
    },
)
