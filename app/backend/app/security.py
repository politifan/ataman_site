from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import AdminUser


def _b64url_encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def hash_password(password: str) -> str:
    iterations = 390_000
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${_b64url_encode(salt)}${_b64url_encode(digest)}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algo, iterations_raw, salt_raw, expected_raw = password_hash.split("$", 3)
        if algo != "pbkdf2_sha256":
            return False
        iterations = int(iterations_raw)
        salt = _b64url_decode(salt_raw)
        expected = _b64url_decode(expected_raw)
    except (ValueError, TypeError):
        return False

    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


@dataclass(frozen=True)
class AdminTokenPayload:
    sub: int
    username: str
    role: str
    exp: int
    iat: int


def create_access_token(user: AdminUser) -> str:
    now_ts = int(time.time())
    ttl_seconds = max(settings.admin_access_ttl_minutes, 1) * 60
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role,
        "iat": now_ts,
        "exp": now_ts + ttl_seconds,
    }
    header = {"alg": "HS256", "typ": "JWT"}

    header_part = _b64url_encode(json.dumps(header, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    payload_part = _b64url_encode(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    unsigned = f"{header_part}.{payload_part}".encode("utf-8")
    signature = hmac.new(settings.admin_jwt_secret.encode("utf-8"), unsigned, hashlib.sha256).digest()
    signature_part = _b64url_encode(signature)
    return f"{header_part}.{payload_part}.{signature_part}"


def decode_access_token(token: str) -> AdminTokenPayload:
    try:
        header_part, payload_part, signature_part = token.split(".", 2)
    except ValueError as exc:
        raise ValueError("Bad token format") from exc

    unsigned = f"{header_part}.{payload_part}".encode("utf-8")
    expected_signature = hmac.new(settings.admin_jwt_secret.encode("utf-8"), unsigned, hashlib.sha256).digest()
    try:
        provided_signature = _b64url_decode(signature_part)
    except Exception as exc:
        raise ValueError("Bad token signature") from exc
    if not hmac.compare_digest(expected_signature, provided_signature):
        raise ValueError("Bad token signature")

    try:
        payload_obj = json.loads(_b64url_decode(payload_part).decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as exc:
        raise ValueError("Bad token payload") from exc

    try:
        sub = int(payload_obj["sub"])
        username = str(payload_obj["username"])
        role = str(payload_obj["role"])
        exp = int(payload_obj["exp"])
        iat = int(payload_obj["iat"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Incomplete token payload") from exc

    if exp <= int(time.time()):
        raise ValueError("Token expired")

    return AdminTokenPayload(sub=sub, username=username, role=role, exp=exp, iat=iat)


def authenticate_admin(db: Session, username: str, password: str) -> AdminUser | None:
    row = db.scalar(select(AdminUser).where(AdminUser.username == username.strip()))
    if not row or not row.is_active:
        return None
    if not verify_password(password, row.password_hash):
        return None

    row.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return row


def get_admin_by_id(db: Session, user_id: int) -> AdminUser | None:
    row = db.get(AdminUser, user_id)
    if not row or not row.is_active:
        return None
    return row


def ensure_bootstrap_admin(db: Session) -> tuple[AdminUser, bool]:
    username = settings.admin_bootstrap_username.strip()
    password = settings.admin_bootstrap_password
    role = settings.admin_bootstrap_role.strip() or "admin"

    existing = db.scalar(select(AdminUser).where(AdminUser.username == username))
    if existing:
        return existing, False

    row = AdminUser(
        username=username,
        password_hash=hash_password(password),
        role=role,
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row, True
