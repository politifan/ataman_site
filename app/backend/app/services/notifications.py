from __future__ import annotations

import logging

import httpx
from sqlalchemy.orm import Session

from ..models import Booking, Contact, GiftCertificate
from .runtime_settings import resolve_telegram_notification_settings

logger = logging.getLogger(__name__)


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
) -> None:
    payload: dict = {
        "chat_id": chat_id,
        "text": text,
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    _post_telegram_method(bot_token, "sendMessage", payload, proxy_url)


def send_telegram_message(db: Session, text: str) -> bool:
    runtime = resolve_telegram_notification_settings(db)
    if not runtime.enabled:
        return False

    delivered = False
    for chat_id in runtime.chat_ids:
        try:
            _post_telegram_message(runtime.bot_token, chat_id, text, runtime.proxy_url)
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


def edit_telegram_message(db: Session, chat_id: str, message_id: int, text: str) -> None:
    runtime = resolve_telegram_notification_settings(db)
    if not runtime.enabled:
        return
    _post_telegram_method(
        runtime.bot_token,
        "editMessageText",
        {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
        },
        runtime.proxy_url,
    )


def notify_contact_created(db: Session, contact: Contact) -> bool:
    parts = [
        "Новый вопрос с сайта «Атман»",
        f"ID: {contact.id}",
        f"Имя: {contact.name}",
        f"Email: {contact.email}",
    ]
    if contact.phone:
        parts.append(f"Телефон: {contact.phone}")
    parts.append("Сообщение:")
    parts.append(contact.message)
    return send_telegram_message(db, "\n".join(parts))


def notify_booking_created(
    db: Session,
    booking: Booking,
    *,
    service_title: str,
    event_label: str,
    is_individual: bool,
) -> bool:
    parts = [
        "Новая запись с сайта «Атман»",
        f"Бронь: #{booking.id}",
        f"Услуга: {service_title}",
        f"Формат: {'индивидуальный' if is_individual else 'групповой'}",
        f"Дата: {event_label}",
        f"Имя: {booking.name}",
        f"Телефон: {booking.phone}",
        f"Email: {booking.email}",
        f"Статус оплаты: {booking.payment_status}",
    ]
    if booking.comment:
        parts.append("Комментарий:")
        parts.append(booking.comment)
    return send_telegram_message(db, "\n".join(parts))


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

    text = "\n".join(
        [
            "Клиент сообщил о переводе",
            f"Бронь: #{booking.id}",
            f"Услуга: {service_title}",
            f"Дата: {event_label}",
            f"Сумма: {booking.payment_amount} руб.",
            f"Имя: {booking.name}",
            f"Телефон: {booking.phone}",
            f"Email: {booking.email}",
            f"Комментарий: {booking.comment or 'нет'}",
            "",
            "Проверьте поступление перевода и выберите действие.",
        ]
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
            _post_telegram_message(runtime.bot_token, chat_id, text, runtime.proxy_url, reply_markup)
            delivered = True
        except Exception:
            logger.exception("Failed to send manual payment notification to chat %s", chat_id)
    return delivered


def notify_certificate_purchase_created(db: Session, certificate: GiftCertificate) -> bool:
    parts = [
        "Новая заявка на сертификат с сайта «Атман»",
        f"Сертификат: #{certificate.id}",
        f"Код: {certificate.code}",
        f"Сумма: {certificate.amount} руб.",
        f"Покупатель: {certificate.buyer_name}",
        f"Телефон: {certificate.buyer_phone or 'не указан'}",
        f"Email: {certificate.buyer_email}",
    ]
    if certificate.recipient_name:
        parts.append(f"Получатель: {certificate.recipient_name}")
    if certificate.note:
        parts.append("Комментарий:")
        parts.append(certificate.note)
    return send_telegram_message(db, "\n".join(parts))
