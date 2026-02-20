from __future__ import annotations

from calendar import monthrange
from datetime import datetime, timedelta

VALIDITY_MODE_THREE_MONTHS = "3m"
VALIDITY_MODE_ONE_MONTH = "1m"
VALIDITY_MODE_CUSTOM_DAYS = "custom_days"

DEFAULT_VALIDITY_MODE = VALIDITY_MODE_THREE_MONTHS
DEFAULT_CUSTOM_VALIDITY_DAYS = 30


def normalize_certificate_validity(
    validity_mode: str | None,
    validity_days: int | None,
) -> tuple[str, int | None]:
    mode = (validity_mode or DEFAULT_VALIDITY_MODE).strip().lower()
    if mode not in {VALIDITY_MODE_THREE_MONTHS, VALIDITY_MODE_ONE_MONTH, VALIDITY_MODE_CUSTOM_DAYS}:
        mode = DEFAULT_VALIDITY_MODE

    if mode == VALIDITY_MODE_CUSTOM_DAYS:
        days = int(validity_days or 0)
        if days < 1:
            days = DEFAULT_CUSTOM_VALIDITY_DAYS
        return mode, days

    return mode, None


def calculate_certificate_expires_at(
    issued_at: datetime,
    validity_mode: str,
    validity_days: int | None,
) -> datetime:
    mode, days = normalize_certificate_validity(validity_mode, validity_days)
    if mode == VALIDITY_MODE_CUSTOM_DAYS:
        expires = issued_at + timedelta(days=days or DEFAULT_CUSTOM_VALIDITY_DAYS)
        return expires.replace(hour=23, minute=59, second=59, microsecond=0)

    months = 1 if mode == VALIDITY_MODE_ONE_MONTH else 3
    month_index = issued_at.year * 12 + (issued_at.month - 1) + months
    target_year = month_index // 12
    target_month = (month_index % 12) + 1
    last_day = monthrange(target_year, target_month)[1]
    return issued_at.replace(
        year=target_year,
        month=target_month,
        day=last_day,
        hour=23,
        minute=59,
        second=59,
        microsecond=0,
    )
