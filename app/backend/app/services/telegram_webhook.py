from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

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


def register_telegram_webhook(db: Session, webhook_url: str | None = None) -> dict[str, Any]:
    runtime = _require_telegram_runtime(db)
    if not runtime.webhook_secret:
        raise RuntimeError("TELEGRAM_WEBHOOK_SECRET is not configured.")

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

