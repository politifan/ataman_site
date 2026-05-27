from __future__ import annotations

import logging

import httpx
from sqlalchemy.orm import Session

from ..models import Booking, Contact, GiftCertificate
from .runtime_settings import resolve_telegram_notification_settings

logger = logging.getLogger(__name__)


def _post_telegram_message(bot_token: str, chat_id: str, text: str) -> None:
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
    }

    with httpx.Client(timeout=10.0) as client:
        response = client.post(url, json=payload)
        response.raise_for_status()


def send_telegram_message(db: Session, text: str) -> bool:
    runtime = resolve_telegram_notification_settings(db)
    if not runtime.enabled:
        return False

    delivered = False
    for chat_id in runtime.chat_ids:
        try:
            _post_telegram_message(runtime.bot_token, chat_id, text)
            delivered = True
        except Exception:
            logger.exception("Failed to send Telegram notification to chat %s", chat_id)
    return delivered


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
