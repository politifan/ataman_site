from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings as env_settings
from ..models import Setting


def _parse_bool(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    raw = value.strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _split_chat_ids(raw_value: str | None) -> list[str]:
    if not raw_value:
        return []

    values = str(raw_value).replace(";", ",").replace("\n", ",")
    return [item.strip() for item in values.split(",") if item.strip()]


def _decode_manual_payment_text(raw_value: str | None) -> str:
    return str(raw_value or "").replace("_", " ").strip()


@dataclass(frozen=True)
class RuntimePaymentSettings:
    shop_id: str
    secret_key: str
    return_url: str
    webhook_secret: str | None
    is_test: bool
    max_verification_attempts: int
    verification_interval: int
    vat_code: int
    receipt_payment_mode: str
    receipt_payment_subject: str

    @property
    def enabled(self) -> bool:
        return bool(self.shop_id and self.secret_key)


@dataclass(frozen=True)
class TelegramNotificationSettings:
    enabled: bool
    bot_token: str
    chat_ids: list[str]
    proxy_url: str | None = None
    webhook_secret: str | None = None


@dataclass(frozen=True)
class ManualPaymentSettings:
    bank: str
    card_number: str
    recipient: str
    instructions: str

    @property
    def enabled(self) -> bool:
        return bool(self.card_number and self.recipient)


def _settings_map(db: Session) -> dict[str, str]:
    rows = db.scalars(select(Setting)).all()
    return {row.key: row.value or "" for row in rows}


def resolve_site_url(db: Session | None = None) -> str:
    if db is not None:
        row = db.scalar(select(Setting.value).where(Setting.key == "site_url"))
        if row and str(row).strip():
            return str(row).strip().rstrip("/")
    return env_settings.site_url.rstrip("/")


def resolve_payment_settings(db: Session) -> RuntimePaymentSettings:
    values = _settings_map(db)
    return RuntimePaymentSettings(
        shop_id=(values.get("yookassa_shop_id") or env_settings.yookassa_shop_id or "").strip(),
        secret_key=(values.get("yookassa_secret_key") or env_settings.yookassa_secret_key or "").strip(),
        return_url=(values.get("yookassa_return_url") or env_settings.yookassa_return_url or "").strip(),
        webhook_secret=(values.get("yookassa_webhook_secret") or env_settings.yookassa_webhook_secret or "").strip()
        or None,
        is_test=_parse_bool(values.get("yookassa_is_test"), True),
        max_verification_attempts=_parse_int(values.get("payment_max_verification_attempts"), 3),
        verification_interval=_parse_int(values.get("payment_verification_interval"), 300),
        vat_code=_parse_int(values.get("payment_vat_code"), 1),
        receipt_payment_mode=(values.get("payment_receipt_mode") or "full_prepayment").strip() or "full_prepayment",
        receipt_payment_subject=(values.get("payment_receipt_subject") or "service").strip() or "service",
    )


def resolve_telegram_notification_settings(db: Session) -> TelegramNotificationSettings:
    values = _settings_map(db)
    bot_token = (values.get("telegram_bot_token") or env_settings.telegram_bot_token or "").strip()
    chat_ids = _split_chat_ids(
        values.get("telegram_chat_ids") or values.get("telegram_chat_id") or env_settings.telegram_chat_ids
    )
    if env_settings.telegram_notifications_enabled:
        enabled = True
    else:
        enabled = _parse_bool(values.get("telegram_notifications_enabled"), bool(bot_token and chat_ids))
    return TelegramNotificationSettings(
        enabled=enabled and bool(bot_token) and bool(chat_ids),
        bot_token=bot_token,
        chat_ids=chat_ids,
        proxy_url=(values.get("telegram_proxy_url") or env_settings.telegram_proxy_url or "").strip() or None,
        webhook_secret=(values.get("telegram_webhook_secret") or env_settings.telegram_webhook_secret or "").strip()
        or None,
    )


def resolve_manual_payment_settings(db: Session) -> ManualPaymentSettings:
    values = _settings_map(db)
    return ManualPaymentSettings(
        bank=_decode_manual_payment_text(values.get("manual_payment_bank") or env_settings.manual_payment_bank),
        card_number=_decode_manual_payment_text(
            values.get("manual_payment_card_number") or env_settings.manual_payment_card_number
        ),
        recipient=_decode_manual_payment_text(
            values.get("manual_payment_recipient") or env_settings.manual_payment_recipient
        ),
        instructions=_decode_manual_payment_text(
            values.get("manual_payment_instructions") or env_settings.manual_payment_instructions or ""
        ),
    )


def ensure_runtime_settings(db: Session) -> None:
    defaults: list[tuple[str, str, bool]] = [
        ("site_url", env_settings.site_url.rstrip("/"), True),
        ("yookassa_shop_id", env_settings.yookassa_shop_id or "", False),
        ("yookassa_secret_key", env_settings.yookassa_secret_key or "", False),
        ("yookassa_return_url", env_settings.yookassa_return_url or "", False),
        ("yookassa_webhook_secret", env_settings.yookassa_webhook_secret or "", False),
        ("yookassa_is_test", "1", False),
        ("payment_max_verification_attempts", "3", False),
        ("payment_verification_interval", "300", False),
        ("payment_vat_code", "1", False),
        ("payment_receipt_mode", "full_prepayment", False),
        ("payment_receipt_subject", "service", False),
        ("telegram_notifications_enabled", "1" if env_settings.telegram_notifications_enabled else "0", False),
        ("telegram_bot_token", env_settings.telegram_bot_token, False),
        ("telegram_chat_ids", env_settings.telegram_chat_ids, False),
        ("telegram_proxy_url", env_settings.telegram_proxy_url, False),
        ("telegram_webhook_secret", env_settings.telegram_webhook_secret, False),
        ("manual_payment_bank", env_settings.manual_payment_bank, False),
        ("manual_payment_card_number", env_settings.manual_payment_card_number, False),
        ("manual_payment_recipient", env_settings.manual_payment_recipient, False),
        ("manual_payment_instructions", env_settings.manual_payment_instructions, False),
    ]

    existing = {
        row.key
        for row in db.query(Setting).all()
    }
    pending = {
        obj.key
        for obj in db.new
        if isinstance(obj, Setting) and getattr(obj, "key", None)
    }
    existing.update(pending)

    for key, value, is_public in defaults:
        if key in existing:
            continue
        db.add(Setting(key=key, value=value, is_public=is_public))
        existing.add(key)


def load_public_setting_values(db: Session, keys: Iterable[str]) -> dict[str, str]:
    required = {key for key in keys if key}
    if not required:
        return {}

    rows = db.scalars(select(Setting).where(Setting.key.in_(required)))
    return {row.key: row.value or "" for row in rows}
