from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..config import settings
from ..deps import AdminPrincipal, get_current_admin, get_db_session
from ..schemas import AdminAuthResponse, AdminAuthUser, AdminLoginRequest, AdminMeResponse
from ..security import authenticate_admin, create_access_token, get_admin_by_id

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=AdminAuthResponse)
def admin_login(payload: AdminLoginRequest, db: Session = Depends(get_db_session)) -> AdminAuthResponse:
    user = authenticate_admin(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Неверный логин или пароль.")

    token = create_access_token(user)
    return AdminAuthResponse(
        access_token=token,
        token_type="bearer",
        expires_in=max(settings.admin_access_ttl_minutes, 1) * 60,
        user=AdminAuthUser(
            id=user.id,
            username=user.username,
            role=user.role,
            is_active=user.is_active,
        ),
    )


@router.get("/me", response_model=AdminMeResponse)
def admin_me(
    principal: AdminPrincipal = Depends(get_current_admin),
    db: Session = Depends(get_db_session),
) -> AdminMeResponse:
    if principal.auth_type == "legacy-token":
        return AdminMeResponse(
            user=AdminAuthUser(
                id=None,
                username=principal.username,
                role=principal.role,
                is_active=True,
            ),
            auth_type=principal.auth_type,
        )

    if principal.id is None:
        raise HTTPException(status_code=401, detail="Некорректный токен администратора.")

    user = get_admin_by_id(db, principal.id)
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь администратора не найден.")

    return AdminMeResponse(
        user=AdminAuthUser(
            id=user.id,
            username=user.username,
            role=user.role,
            is_active=user.is_active,
        ),
        auth_type=principal.auth_type,
    )
