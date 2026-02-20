from __future__ import annotations

import hmac
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .security import decode_access_token, get_admin_by_id

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AdminPrincipal:
    id: int | None
    username: str
    role: str
    auth_type: str


def get_db_session(db: Session = Depends(get_db)) -> Session:
    return db


def _legacy_admin_principal(x_admin_token: str | None) -> AdminPrincipal | None:
    if not settings.admin_token:
        return None
    if x_admin_token and hmac.compare_digest(x_admin_token, settings.admin_token):
        return AdminPrincipal(
            id=None,
            username="legacy_token_admin",
            role="admin",
            auth_type="legacy-token",
        )
    return None


def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    x_admin_token: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> AdminPrincipal:
    if credentials and credentials.scheme.lower() == "bearer":
        token = credentials.credentials.strip()
        if not token:
            raise HTTPException(status_code=401, detail="Сессия недействительна. Войдите снова.")
        try:
            payload = decode_access_token(token)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Сессия недействительна. Войдите снова.") from exc

        user = get_admin_by_id(db, payload.sub)
        if not user:
            raise HTTPException(status_code=401, detail="Сессия истекла. Войдите снова.")
        return AdminPrincipal(
            id=user.id,
            username=user.username,
            role=user.role,
            auth_type="jwt",
        )

    legacy = _legacy_admin_principal(x_admin_token)
    if legacy:
        return legacy

    raise HTTPException(status_code=401, detail="Требуется авторизация администратора.")


def require_admin_role(*allowed_roles: str):
    normalized = {role.strip().lower() for role in allowed_roles if role.strip()}
    if not normalized:
        normalized = {"admin"}

    def dependency(principal: AdminPrincipal = Depends(get_current_admin)) -> AdminPrincipal:
        if principal.role.lower() not in normalized:
            raise HTTPException(status_code=403, detail="Недостаточно прав для выполнения действия.")
        return principal

    return dependency


def require_admin(principal: AdminPrincipal = Depends(require_admin_role("admin", "editor"))) -> AdminPrincipal:
    return principal
