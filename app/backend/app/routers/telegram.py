from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..deps import get_db_session
from ..models import Booking, ScheduleEvent
from ..services.notifications import answer_telegram_callback, edit_telegram_message
from ..services.runtime_settings import resolve_telegram_notification_settings

router = APIRouter(prefix="/api/telegram", tags=["telegram"])
logger = logging.getLogger(__name__)


def _parse_manual_payment_callback(raw_value: str) -> tuple[str, int] | None:
    parts = raw_value.split(":")
    if len(parts) != 3 or parts[0] != "manual_payment" or parts[1] not in {"approve", "reject"}:
        return None
    try:
        return parts[1], int(parts[2])
    except ValueError:
        return None


@router.post("/webhook")
def telegram_webhook(
    update: dict[str, Any],
    x_telegram_bot_api_secret_token: str | None = Header(
        default=None,
        alias="X-Telegram-Bot-Api-Secret-Token",
    ),
    db: Session = Depends(get_db_session),
) -> dict[str, bool]:
    runtime = resolve_telegram_notification_settings(db)
    if not runtime.webhook_secret:
        raise HTTPException(status_code=503, detail="Telegram webhook secret не настроен.")
    if not x_telegram_bot_api_secret_token or not secrets.compare_digest(
        x_telegram_bot_api_secret_token,
        runtime.webhook_secret,
    ):
        raise HTTPException(status_code=401, detail="Невалидный Telegram webhook secret.")

    callback = update.get("callback_query")
    if not isinstance(callback, dict):
        return {"ok": True}

    callback_id = str(callback.get("id") or "")
    message = callback.get("message")
    if not isinstance(message, dict):
        raise HTTPException(status_code=400, detail="Callback не содержит сообщение.")

    chat = message.get("chat")
    chat_id = str(chat.get("id") if isinstance(chat, dict) else "")
    if chat_id not in runtime.chat_ids:
        if callback_id:
            answer_telegram_callback(db, callback_id, "Этот чат не может подтверждать записи.")
        raise HTTPException(status_code=403, detail="Telegram chat не авторизован.")

    parsed = _parse_manual_payment_callback(str(callback.get("data") or ""))
    if not parsed:
        if callback_id:
            answer_telegram_callback(db, callback_id, "Неизвестное действие.")
        return {"ok": True}

    action, booking_id = parsed
    booking = db.scalar(
        select(Booking)
        .options(joinedload(Booking.schedule_event).joinedload(ScheduleEvent.service))
        .where(Booking.id == booking_id)
        .with_for_update()
    )
    if not booking:
        if callback_id:
            answer_telegram_callback(db, callback_id, "Бронь не найдена.")
        return {"ok": True}

    event = booking.schedule_event
    if action == "approve":
        if booking.payment_status == "manual_rejected":
            result_text = "Перевод уже отклонён."
        else:
            if not booking.slot_reserved:
                if event.current_participants >= event.max_participants:
                    if callback_id:
                        answer_telegram_callback(db, callback_id, "Свободных мест больше нет.")
                    return {"ok": True}
                event.current_participants += 1
                booking.slot_reserved = True
            booking.status = "confirmed"
            booking.payment_status = "manual_confirmed"
            booking.paid_at = datetime.now(timezone.utc)
            result_text = "Перевод подтверждён. Запись активна."
    else:
        if booking.payment_status == "manual_confirmed":
            result_text = "Перевод уже подтверждён."
        else:
            if booking.slot_reserved and event.current_participants > 0:
                event.current_participants -= 1
            booking.slot_reserved = False
            booking.status = "cancelled"
            booking.payment_status = "manual_rejected"
            result_text = "Перевод отклонён. Резерв снят."

    db.commit()

    if callback_id:
        try:
            answer_telegram_callback(db, callback_id, result_text)
        except Exception:
            logger.exception("Failed to answer Telegram callback for booking %s", booking.id)
    message_id = message.get("message_id")
    if isinstance(message_id, int):
        original_text = str(message.get("text") or "").strip()
        try:
            edit_telegram_message(db, chat_id, message_id, f"{original_text}\n\n{result_text}")
        except Exception:
            logger.exception("Failed to edit Telegram message for booking %s", booking.id)
    return {"ok": True}
