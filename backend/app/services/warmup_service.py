"""
Email domain warmup service.
Manages gradual sending volume increases to build sender reputation.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

# Daily sending limits for each warmup day
WARMUP_SCHEDULE = [
    20,     # Day 1
    40,     # Day 2
    80,     # Day 3
    160,    # Day 4
    320,    # Day 5
    500,    # Day 6
    750,    # Day 7
    1000,   # Day 8
    1500,   # Day 9
    2000,   # Day 10
    3000,   # Day 11
    5000,   # Day 12
    7500,   # Day 13
    10000,  # Day 14+
]

MAX_WARMUP_DAYS = len(WARMUP_SCHEDULE)


def get_daily_limit(warmup_day: int) -> int:
    """Return the sending limit for a given warmup day (1-indexed)."""
    if warmup_day <= 0:
        return WARMUP_SCHEDULE[0]
    idx = min(warmup_day - 1, MAX_WARMUP_DAYS - 1)
    return WARMUP_SCHEDULE[idx]


def get_schedule_display() -> list[dict]:
    """Return the full warmup schedule for display."""
    return [
        {"day": i + 1, "limit": limit}
        for i, limit in enumerate(WARMUP_SCHEDULE)
    ]


def is_warmup_complete(warmup_day: int) -> bool:
    return warmup_day >= MAX_WARMUP_DAYS


def should_advance_day(last_advanced: Optional[datetime]) -> bool:
    """Return True if 24 hours have passed since the last advance."""
    if last_advanced is None:
        return True
    now = datetime.now(timezone.utc)
    # Ensure last_advanced is timezone-aware
    if last_advanced.tzinfo is None:
        last_advanced = last_advanced.replace(tzinfo=timezone.utc)
    return (now - last_advanced) >= timedelta(hours=24)


def advance_warmup(domain) -> bool:
    """
    Advance the warmup day by 1 if 24 hours have passed.
    Mutates the domain object in-place. Returns True if advanced.
    """
    if not domain.warmup_enabled:
        return False
    if is_warmup_complete(domain.warmup_day):
        return False
    if not should_advance_day(domain.warmup_last_advanced):
        return False

    domain.warmup_day += 1
    domain.warmup_daily_limit = get_daily_limit(domain.warmup_day)
    domain.warmup_sent_today = 0
    domain.warmup_last_advanced = datetime.now(timezone.utc)
    return True


def check_warmup_limit(domain) -> tuple[bool, int]:
    """
    Check if the domain can send more emails today.
    Returns (can_send: bool, remaining: int).
    """
    if not domain.warmup_enabled:
        return True, 999999  # No warmup limit

    remaining = max(0, domain.warmup_daily_limit - domain.warmup_sent_today)
    return remaining > 0, remaining


def warmup_progress_pct(warmup_day: int) -> float:
    return round(min(100.0, (warmup_day / MAX_WARMUP_DAYS) * 100), 1)
