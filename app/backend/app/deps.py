from __future__ import annotations

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db


def get_db_session(db: Session = Depends(get_db)) -> Session:
    return db


def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    if not settings.admin_token:
        raise HTTPException(
            status_code=503,
            detail="ADMIN_TOKEN не настроен. Защитите админ-эндпоинты переменной окружения.",
        )
    if x_admin_token != settings.admin_token:
        raise HTTPException(status_code=401, detail="Недействительный admin token.")
