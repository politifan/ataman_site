from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Setting
from .notifications import _post_telegram_method
from .runtime_settings import resolve_site_url, resolve_telegram_notification_settings


def _require_telegram_runtime(db: Session):
    runtime = resolve_telegram_notification_settings(db)
    if not runtime.enabled:
        raise RuntimeError(
            "Telegram notifications are disabled or TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_IDS are not configured."
        )
    return runtime


def get_telegram_webhook_info(db: Session) -> dict[str, Any]:
    runtime = _require_telegram_runtime(db)
    response = _post_telegram_method(runtime.bot_token, "getWebhookInfo", {}, runtime.proxy_url)
    result = response.get("result")
    return result if isinstance(result, dict) else {}


def _persist_runtime_telegram_settings(db: Session, runtime) -> None:
    values = {
        "telegram_notifications_enabled": "1",
        "telegram_bot_token": runtime.bot_token,
        "telegram_chat_ids": ",".join(runtime.chat_ids),
        "telegram_proxy_url": runtime.proxy_url or "",
        "telegram_webhook_secret": runtime.webhook_secret or "",
    }
    rows = {
        row.key: row
        for row in db.scalars(select(Setting).where(Setting.key.in_(values))).all()
    }
    changed = False
    for key, value in values.items():
        if not value:
            continue
        row = rows.get(key)
        if row is None:
            db.add(Setting(key=key, value=value, is_public=False))
            changed = True
        elif not (row.value or "").strip():
            row.value = value
            changed = True
    if changed:
        db.commit()


def register_telegram_webhook(db: Session, webhook_url: str | None = None) -> dict[str, Any]:
    runtime = _require_telegram_runtime(db)
    if not runtime.webhook_secret:
        raise RuntimeError("TELEGRAM_WEBHOOK_SECRET is not configured.")

    _persist_runtime_telegram_settings(db, runtime)
    url = (webhook_url or f"{resolve_site_url(db)}/api/telegram/webhook").strip()
    _post_telegram_method(
        runtime.bot_token,
        "setWebhook",
        {
            "url": url,
            "secret_token": runtime.webhook_secret,
            "allowed_updates": ["callback_query"],
        },
        runtime.proxy_url,
    )
    return get_telegram_webhook_info(db)
