from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..config import settings
from ..deps import get_db_session
from ..models import Booking, Payment, PaymentLog
from ..schemas import PaymentStatusResponse, PaymentWebhookEnvelope
from ..services.yookassa import YookassaClient, safe_json_loads, verify_legacy_signature

router = APIRouter(prefix="/api/payments", tags=["payments"])


def _apply_payment_state(
    *,
    db: Session,
    payment: Payment,
    new_status: str,
    payment_method: str | None,
    payload: dict,
    event_type: str,
) -> None:
    payment.status = new_status
    payment.payment_method = payment_method
    payment.raw_payload = payload

    booking = payment.booking
    schedule = booking.schedule_event

    if new_status == "succeeded":
        if booking.status != "confirmed":
            if schedule.current_participants >= schedule.max_participants:
                raise HTTPException(status_code=409, detail="Платеж оплачен, но мест уже нет. Требуется ручная проверка.")
            schedule.current_participants += 1
        booking.status = "confirmed"
        booking.payment_status = "paid"
        booking.paid_at = datetime.now(timezone.utc)
        payment.paid_at = datetime.now(timezone.utc)
    elif new_status in {"canceled", "cancelled"}:
        booking.status = "cancelled"
        booking.payment_status = "failed"
    else:
        booking.status = "waiting_payment"
        booking.payment_status = new_status

    db.add(
        PaymentLog(
            payment=payment,
            event_type=event_type,
            payload=payload,
        )
    )


def _build_redirect(payment_id: str, status: str) -> str | None:
    base = settings.yookassa_return_url.rstrip("/")
    if status == "succeeded":
        return f"{base}/payment/success?payment_id={payment_id}"
    if status == "waiting_for_capture":
        return f"{base}/payment/waiting?payment_id={payment_id}"
    if status in {"canceled", "cancelled"}:
        return f"{base}/payment/failed?payment_id={payment_id}"
    return None


@router.get("/{provider_payment_id}/status", response_model=PaymentStatusResponse)
def check_payment_status(provider_payment_id: str, db: Session = Depends(get_db_session)) -> PaymentStatusResponse:
    payment = db.scalar(
        select(Payment)
        .options(
            joinedload(Payment.booking).joinedload(Booking.schedule_event),
        )
        .where(Payment.provider_payment_id == provider_payment_id)
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Платеж не найден.")

    yk = YookassaClient()
    result = yk.get_payment(provider_payment_id)

    _apply_payment_state(
        db=db,
        payment=payment,
        new_status=result.status,
        payment_method=result.payment_method,
        payload=result.payload,
        event_type="manual_status_check",
    )
    db.commit()
    db.refresh(payment)
    db.refresh(payment.booking)

    return PaymentStatusResponse(
        payment_id=provider_payment_id,
        status=result.status,
        booking_status=payment.booking.status,
        redirect_url=_build_redirect(provider_payment_id, result.status),
    )


@router.post("/webhook")
async def yookassa_webhook(
    request: Request,
    x_payment_sha1_hash: str | None = Header(default=None),
    db: Session = Depends(get_db_session),
) -> dict[str, bool]:
    raw_body = await request.body()
    if not verify_legacy_signature(raw_body, x_payment_sha1_hash):
        raise HTTPException(status_code=401, detail="Невалидная подпись webhook.")

    payload = safe_json_loads(raw_body)
    envelope = PaymentWebhookEnvelope.model_validate(payload)
    provider_payment_id = str(envelope.object.get("id", ""))
    if not provider_payment_id:
        raise HTTPException(status_code=400, detail="Webhook не содержит payment id.")

    payment = db.scalar(
        select(Payment)
        .options(
            joinedload(Payment.booking).joinedload(Booking.schedule_event),
        )
        .where(Payment.provider_payment_id == provider_payment_id)
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Платеж не найден.")

    status = str(envelope.object.get("status", "")).strip()
    if not status:
        raise HTTPException(status_code=400, detail="Webhook не содержит статус платежа.")
    payment_method = None
    if isinstance(envelope.object.get("payment_method"), dict):
        payment_method = envelope.object["payment_method"].get("type")

    _apply_payment_state(
        db=db,
        payment=payment,
        new_status=status,
        payment_method=payment_method,
        payload=payload,
        event_type=envelope.event,
    )
    db.commit()
    return {"ok": True}
