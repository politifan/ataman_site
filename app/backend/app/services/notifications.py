from __future__ import annotations

import logging
import re

import httpx
from sqlalchemy.orm import Session

from ..models import Booking, Contact, GiftCertificate
from .runtime_settings import resolve_telegram_notification_settings

logger = logging.getLogger(__name__)
MARKDOWN_V2_SPECIALS = re.compile(r"([_*\[\]()~`>#+\-=|{}.!\\])")


def escape_telegram_markdown(value: object) -> str:
    return MARKDOWN_V2_SPECIALS.sub(r"\\\1", str(value))


def _md_title(value: object) -> str:
    return f"*{escape_telegram_markdown(value)}*"


def _md_line(label: object, value: object) -> str:
    return f"*{escape_telegram_markdown(label)}:* {escape_telegram_markdown(value)}"


def _post_telegram_method(
    bot_token: str,
    method: str,
    payload: dict,
    proxy_url: str | None = None,
) -> dict:
    url = f"https://api.telegram.org/bot{bot_token}/{method}"
    with httpx.Client(timeout=10.0, proxy=proxy_url) as client:
        response = client.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
    if not result.get("ok"):
        raise RuntimeError(f"Telegram API returned an error for {method}")
    return result


def _post_telegram_message(
    bot_token: str,
    chat_id: str,
    text: str,
    proxy_url: str | None = None,
    reply_markup: dict | None = None,
    parse_mode: str | None = None,
) -> None:
    payload: dict = {
        "chat_id": chat_id,
        "text": text,
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    if parse_mode:
        payload["parse_mode"] = parse_mode
    _post_telegram_method(bot_token, "sendMessage", payload, proxy_url)


def send_telegram_message(db: Session, text: str, *, parse_mode: str | None = None) -> bool:
    runtime = resolve_telegram_notification_settings(db)
    if not runtime.enabled:
        return False

    delivered = False
    for chat_id in runtime.chat_ids:
        try:
            _post_telegram_message(runtime.bot_token, chat_id, text, runtime.proxy_url, parse_mode=parse_mode)
            delivered = True
        except Exception:
            logger.exception("Failed to send Telegram notification to chat %s", chat_id)
    return delivered


def answer_telegram_callback(db: Session, callback_query_id: str, text: str) -> None:
    runtime = resolve_telegram_notification_settings(db)
    if not runtime.enabled:
        return
    _post_telegram_method(
        runtime.bot_token,
        "answerCallbackQuery",
        {"callback_query_id": callback_query_id, "text": text},
        runtime.proxy_url,
    )


def edit_telegram_message(
    db: Session,
    chat_id: str,
    message_id: int,
    text: str,
    *,
    reply_markup: dict | None = None,
    parse_mode: str | None = None,
) -> None:
    runtime = resolve_telegram_notification_settings(db)
    if not runtime.enabled:
        return
    payload: dict = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text,
    }
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    if parse_mode:
        payload["parse_mode"] = parse_mode
    _post_telegram_method(
        runtime.bot_token,
        "editMessageText",
        payload,
        runtime.proxy_url,
    )


def remove_telegram_inline_keyboard(db: Session, chat_id: str, message_id: int) -> None:
    runtime = resolve_telegram_notification_settings(db)
    if not runtime.enabled:
        return
    _post_telegram_method(
        runtime.bot_token,
        "editMessageReplyMarkup",
        {
            "chat_id": chat_id,
            "message_id": message_id,
            "reply_markup": {"inline_keyboard": []},
        },
        runtime.proxy_url,
    )


def notify_contact_created(db: Session, contact: Contact) -> bool:
    parts = [
        f"💬 {_md_title('Новый вопрос с сайта «Атман»')}",
        "",
        _md_line("ID", contact.id),
        _md_line("Имя", contact.name),
        _md_line("Email", contact.email),
    ]
    if contact.phone:
        parts.append(_md_line("Телефон", contact.phone))
    parts.extend(["", _md_title("Сообщение"), escape_telegram_markdown(contact.message)])
    return send_telegram_message(db, "\n".join(parts), parse_mode="MarkdownV2")


def notify_booking_created(
    db: Session,
    booking: Booking,
    *,
    service_title: str,
    event_label: str,
    is_individual: bool,
) -> bool:
    parts = [
        f"📅 {_md_title('Новая запись с сайта «Атман»')}",
        "",
        _md_line("Бронь", f"#{booking.id}"),
        _md_line("Услуга", service_title),
        _md_line("Формат", "индивидуальный" if is_individual else "групповой"),
        _md_line("Дата", event_label),
        _md_line("Имя", booking.name),
        _md_line("Телефон", booking.phone),
        _md_line("Email", booking.email),
        _md_line("Статус оплаты", booking.payment_status),
    ]
    if booking.comment:
        parts.extend(["", _md_title("Комментарий"), escape_telegram_markdown(booking.comment)])
    return send_telegram_message(db, "\n".join(parts), parse_mode="MarkdownV2")


def render_manual_transfer_message(
    booking: Booking,
    *,
    service_title: str,
    event_label: str,
    outcome: str | None = None,
) -> str:
    parts = [
        f"💳 {_md_title('Перевод по записи')}",
        "",
        _md_line("Бронь", f"#{booking.id}"),
        _md_line("Услуга", service_title),
        _md_line("Дата", event_label),
        _md_line("Сумма", f"{booking.payment_amount} руб."),
        _md_line("Имя", booking.name),
        _md_line("Телефон", booking.phone),
        _md_line("Email", booking.email),
        _md_line("Комментарий", booking.comment or "нет"),
        "",
    ]
    if outcome:
        parts.extend([_md_title("Решение администратора"), escape_telegram_markdown(outcome)])
    else:
        parts.extend(
            [
                _md_title("Требуется проверка"),
                escape_telegram_markdown("Клиент сообщил о переводе. Проверьте поступление и выберите действие."),
            ]
        )
    return "\n".join(parts)


def notify_manual_transfer_reported(
    db: Session,
    booking: Booking,
    *,
    service_title: str,
    event_label: str,
) -> bool:
    runtime = resolve_telegram_notification_settings(db)
    if not runtime.enabled:
        return False

    text = render_manual_transfer_message(
        booking,
        service_title=service_title,
        event_label=event_label,
    )
    reply_markup = {
        "inline_keyboard": [
            [
                {"text": "Подтвердить", "callback_data": f"manual_payment:approve:{booking.id}"},
                {"text": "Отклонить", "callback_data": f"manual_payment:reject:{booking.id}"},
            ]
        ]
    }

    delivered = False
    for chat_id in runtime.chat_ids:
        try:
            _post_telegram_message(
                runtime.bot_token,
                chat_id,
                text,
                runtime.proxy_url,
                reply_markup,
                parse_mode="MarkdownV2",
            )
            delivered = True
        except Exception:
            logger.exception("Failed to send manual payment notification to chat %s", chat_id)
    return delivered


def notify_certificate_purchase_created(db: Session, certificate: GiftCertificate) -> bool:
    parts = [
        f"🎁 {_md_title('Новая заявка на сертификат')}",
        "",
        _md_line("Сертификат", f"#{certificate.id}"),
        _md_line("Код", certificate.code),
        _md_line("Сумма", f"{certificate.amount} руб."),
        _md_line("Покупатель", certificate.buyer_name),
        _md_line("Телефон", certificate.buyer_phone or "не указан"),
        _md_line("Email", certificate.buyer_email),
    ]
    if certificate.recipient_name:
        parts.append(_md_line("Получатель", certificate.recipient_name))
    if certificate.note:
        parts.extend(["", _md_title("Комментарий"), escape_telegram_markdown(certificate.note)])
    return send_telegram_message(db, "\n".join(parts), parse_mode="MarkdownV2")
