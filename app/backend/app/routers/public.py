from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..deps import get_db_session
from ..models import Booking, Contact, Payment, ScheduleEvent, Service, Setting
from ..schemas import (
    BookingCreate,
    BookingCreateResponse,
    ContactCreate,
    ContactResponse,
    SchedulePublic,
    ServicePublic,
    SiteResponse,
)
from ..services.yookassa import YookassaClient

router = APIRouter(prefix="/api", tags=["public"])


def _parse_json_or_default(raw: str | None, default: Any) -> Any:
    if not raw:
        return default
    try:
        return json.loads(raw)
    except Exception:
        return default


def _serialize_site(settings_rows: list[Setting]) -> SiteResponse:
    settings_map = {row.key: row.value for row in settings_rows}

    visual = _parse_json_or_default(
        settings_map.get("visual"),
        {
            "font_family": "Helvetica Now Display",
            "home_background": "#1b245c",
            "home_title_color": "#f7ebac",
            "home_text_color": "#fffdf2",
            "service_background": "#f3efe8",
            "service_title_color": "#446799",
            "service_text_color": "#5f748a",
        },
    )
    contacts = _parse_json_or_default(settings_map.get("contacts"), {})

    return SiteResponse(
        brand=settings_map.get("brand", "СТУДИЯ АТМАН"),
        tagline=settings_map.get("tagline", ""),
        subline=settings_map.get("subline", ""),
        home_image=settings_map.get("home_image"),
        visual=visual,
        contacts=contacts,
    )


def _service_to_public(service: Service) -> ServicePublic:
    payload = {
        "id": service.id,
        "slug": service.slug,
        "title": service.title,
        "category": service.category,
        "category_label": service.category_label,
        "format_mode": service.format_mode,
        "teaser": service.teaser,
        "duration": service.duration,
        "pricing": service.pricing or {},
        "about": service.about or [],
        "suitable_for": service.suitable_for or [],
        "host": service.host or {},
        "important": service.important or [],
        "dress_code": service.dress_code or [],
        "contraindications": service.contraindications or [],
        "media": service.media or [],
        "age_restriction": service.age_restriction,
        "is_draft": bool(service.is_draft),
        "is_active": bool(service.is_active),
    }
    return ServicePublic.model_validate(payload)


def _schedule_to_public(event: ScheduleEvent) -> SchedulePublic:
    available_spots = max(0, event.max_participants - event.current_participants)
    return SchedulePublic(
        id=event.id,
        service_id=event.service_id,
        service_slug=event.service.slug,
        service_title=event.service.title,
        start_time=event.start_time,
        end_time=event.end_time,
        max_participants=event.max_participants,
        current_participants=event.current_participants,
        available_spots=available_spots,
        is_individual=event.is_individual,
        is_active=event.is_active,
    )


def _extract_group_price(service: Service, event: ScheduleEvent) -> Decimal:
    pricing = service.pricing or {}
    value: Any = None
    if event.is_individual:
        value = (pricing.get("individual") or {}).get("price")
        if value is None:
            value = (pricing.get("fixed") or {}).get("price")
    else:
        value = (pricing.get("group") or {}).get("price_per_person")
        if value is None:
            value = (pricing.get("fixed") or {}).get("price")

    if value is None:
        raise HTTPException(status_code=422, detail="Для услуги не настроена стоимость.")

    return Decimal(str(value))


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/site", response_model=SiteResponse)
def get_site(db: Session = Depends(get_db_session)) -> SiteResponse:
    rows = db.scalars(select(Setting).where(Setting.is_public.is_(True))).all()
    return _serialize_site(rows)


@router.get("/services", response_model=list[ServicePublic])
def list_services(
    format_mode: str | None = Query(default=None, pattern="^(group_and_individual|individual_only)$"),
    include_drafts: bool = False,
    db: Session = Depends(get_db_session),
) -> list[ServicePublic]:
    query = select(Service).where(Service.is_active.is_(True))
    if not include_drafts:
        query = query.where(Service.is_draft.is_(False))
    if format_mode:
        query = query.where(Service.format_mode == format_mode)
    query = query.order_by(Service.id.asc())
    services = db.scalars(query).all()
    return [_service_to_public(item) for item in services]


@router.get("/services/{slug}", response_model=ServicePublic)
def get_service(slug: str, db: Session = Depends(get_db_session)) -> ServicePublic:
    service = db.scalar(
        select(Service).where(
            Service.slug == slug,
            Service.is_active.is_(True),
        )
    )
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена.")
    return _service_to_public(service)


@router.get("/schedule", response_model=list[SchedulePublic])
def list_schedule(service_slug: str | None = None, db: Session = Depends(get_db_session)) -> list[SchedulePublic]:
    query = (
        select(ScheduleEvent)
        .join(Service)
        .options(joinedload(ScheduleEvent.service))
        .where(ScheduleEvent.is_active.is_(True), Service.is_active.is_(True))
        .order_by(ScheduleEvent.start_time.asc())
    )
    if service_slug:
        query = query.where(Service.slug == service_slug)
    rows = db.scalars(query).all()
    return [_schedule_to_public(item) for item in rows]


@router.post("/contacts", response_model=ContactResponse)
def create_contact(payload: ContactCreate, db: Session = Depends(get_db_session)) -> ContactResponse:
    row = Contact(
        name=payload.name.strip(),
        email=str(payload.email),
        phone=(payload.phone or "").strip() or None,
        message=payload.message.strip(),
        status="new",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ContactResponse(
        ok=True,
        id=row.id,
        message="Спасибо! Мы получили сообщение и скоро свяжемся с вами.",
    )


@router.post("/bookings", response_model=BookingCreateResponse)
def create_booking(payload: BookingCreate, db: Session = Depends(get_db_session)) -> BookingCreateResponse:
    if not (payload.privacy_policy and payload.personal_data and payload.terms):
        raise HTTPException(
            status_code=422,
            detail="Необходимо принять политику конфиденциальности, обработку персональных данных и условия услуг.",
        )

    event = db.scalar(
        select(ScheduleEvent)
        .options(joinedload(ScheduleEvent.service))
        .where(ScheduleEvent.id == payload.schedule_id)
        .with_for_update()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Событие расписания не найдено.")
    if not event.is_active:
        raise HTTPException(status_code=409, detail="Событие неактивно.")
    if event.is_individual:
        raise HTTPException(
            status_code=409,
            detail="Индивидуальные практики бронируются через прямую связь с администратором.",
        )
    if event.current_participants >= event.max_participants:
        raise HTTPException(status_code=409, detail="Свободных мест больше нет.")

    amount = _extract_group_price(event.service, event)

    booking = Booking(
        schedule_event_id=event.id,
        name=payload.name.strip(),
        phone=payload.phone.strip(),
        email=str(payload.email),
        comment=(payload.comment or "").strip() or None,
        status="pending",
        payment_status="pending",
        payment_amount=amount,
    )
    db.add(booking)
    db.flush()

    yk = YookassaClient()
    payment_result = yk.create_payment(
        booking_id=booking.id,
        amount=amount,
        description=f"Оплата: {event.service.title} ({event.start_time:%d.%m.%Y %H:%M})",
    )

    payment = Payment(
        booking_id=booking.id,
        provider="yookassa",
        provider_payment_id=payment_result.payment_id,
        amount=amount,
        currency="RUB",
        status=payment_result.status,
        payment_method=payment_result.payment_method,
        confirmation_url=payment_result.confirmation_url,
        raw_payload=payment_result.payload,
    )
    db.add(payment)

    booking.payment_id = payment_result.payment_id
    booking.payment_status = payment_result.status
    booking.payment_confirmation_url = payment_result.confirmation_url
    booking.status = "waiting_payment"

    db.commit()
    db.refresh(booking)

    return BookingCreateResponse(
        ok=True,
        booking_id=booking.id,
        payment_id=payment_result.payment_id,
        payment_status=payment_result.status,
        confirmation_url=payment_result.confirmation_url,
        message="Бронь создана. Перенаправляем на оплату.",
    )


@router.get("/migration/status")
def migration_status() -> dict[str, list[str]]:
    return {
        "completed_now": [
            "FastAPI + MySQL через SQLAlchemy",
            "Alembic-миграции",
            "ЮKassa create/check/webhook",
            "Admin CRUD API: услуги/расписание/галерея",
        ],
        "next_stage": [
            "JWT-авторизация админки",
            "Загрузка файлов в admin API",
            "Расширение SEO/контентных блоков",
        ],
    }
