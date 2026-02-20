from __future__ import annotations

import json
import secrets
from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, Form, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..deps import get_db_session
from ..models import Booking, Contact, GalleryItem, GiftCertificate, Payment, ScheduleEvent, Service, Setting
from ..schemas import (
    BookingCreate,
    BookingCreateResponse,
    ContactCreate,
    ContactResponse,
    GalleryPublic,
    GiftCertificatePublicResponse,
    GiftCertificatePurchaseRequest,
    GiftCertificatePurchaseResponse,
    LegalPageResponse,
    SchedulePublic,
    ServicePublic,
    SiteResponse,
)
from ..services.yookassa import YookassaClient

router = APIRouter(prefix="/api", tags=["public"])

DEFAULT_LEGAL_PAGES: dict[str, dict[str, str]] = {
    "offer": {
        "title": "Публичная оферта",
        "content": (
            "Настоящий документ является предложением заключить договор оказания услуг студии Атман. "
            "Оплата услуги и/или подтверждение записи означает принятие условий оферты."
        ),
    },
    "privacy": {
        "title": "Политика конфиденциальности",
        "content": (
            "Мы обрабатываем персональные данные только для оказания услуг и обратной связи. "
            "Данные не передаются третьим лицам без законных оснований."
        ),
    },
    "personal-data": {
        "title": "Согласие на обработку персональных данных",
        "content": (
            "Оставляя заявку на сайте, пользователь подтверждает согласие на обработку персональных данных "
            "в соответствии с 152-ФЗ."
        ),
    },
    "marketing": {
        "title": "Согласие на информационную рассылку",
        "content": (
            "Пользователь может получать информационные и маркетинговые сообщения студии и в любой момент "
            "отозвать согласие, обратившись по контактам на сайте."
        ),
    },
    "terms": {
        "title": "Условия оказания услуг",
        "content": (
            "Запись на практики подтверждается после оформления заявки. Время и формат участия могут уточняться "
            "администратором. Для отдельных услуг действуют ограничения и правила подготовки."
        ),
    },
}


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
    if not isinstance(contacts, dict):
        contacts = {}
    contacts = {
        **contacts,
        "phone": contacts.get("phone") or settings_map.get("contact_phone") or "",
        "phone_2": contacts.get("phone_2") or settings_map.get("contact_phone_2") or "",
        "email": contacts.get("email") or settings_map.get("contact_email") or "",
        "address": contacts.get("address") or settings_map.get("contact_address") or "",
        "working_hours": contacts.get("working_hours") or settings_map.get("working_hours") or "",
        "telegram": contacts.get("telegram") or settings_map.get("social_telegram") or "",
        "vk": contacts.get("vk") or settings_map.get("social_vk") or "",
        "rutube": contacts.get("rutube") or settings_map.get("social_rutube") or "",
    }

    organization = {
        "name": settings_map.get("org_name", ""),
        "inn": settings_map.get("org_inn", ""),
        "ogrnip": settings_map.get("org_ogrnip", ""),
    }

    analytics = {
        "metrika_id": settings_map.get("metrika_id", ""),
    }

    return SiteResponse(
        brand=settings_map.get("brand", "СТУДИЯ АТМАН"),
        tagline=settings_map.get("tagline", ""),
        subline=settings_map.get("subline", ""),
        home_image=settings_map.get("home_image"),
        visual=visual,
        contacts=contacts,
        organization=organization,
        analytics=analytics,
    )


def _service_to_public(service: Service) -> ServicePublic:
    def as_dict(value: Any) -> dict[str, Any]:
        if isinstance(value, dict):
            return value
        return {}

    def as_list(value: Any) -> list[Any]:
        if isinstance(value, list):
            return value
        return []

    payload = {
        "id": service.id,
        "slug": service.slug,
        "title": service.title,
        "category": service.category,
        "category_label": service.category_label,
        "format_mode": service.format_mode,
        "teaser": service.teaser,
        "duration": service.duration,
        "pricing": as_dict(service.pricing),
        "about": as_list(service.about),
        "suitable_for": as_list(service.suitable_for),
        "host": as_dict(service.host),
        "important": as_list(service.important),
        "dress_code": as_list(service.dress_code),
        "contraindications": as_list(service.contraindications),
        "media": as_list(service.media),
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


def _certificate_public_url(code: str) -> str:
    return f"/certificates/{code}"


def _generate_certificate_code(db: Session) -> str:
    for _ in range(10):
        code = f"ATM-{secrets.token_hex(4).upper()}"
        exists = db.scalar(select(GiftCertificate.id).where(GiftCertificate.code == code))
        if not exists:
            return code
    raise HTTPException(status_code=500, detail="Не удалось сгенерировать уникальный код сертификата.")


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/site", response_model=SiteResponse)
def get_site(db: Session = Depends(get_db_session)) -> SiteResponse:
    rows = db.scalars(select(Setting).where(Setting.is_public.is_(True))).all()
    return _serialize_site(rows)


@router.get("/services")
def list_services(
    format_mode: str | None = Query(default=None, pattern="^(group_and_individual|individual_only)$"),
    include_drafts: bool = False,
    db: Session = Depends(get_db_session),
) -> JSONResponse:
    try:
        query = select(Service).where(Service.is_active.is_(True))
        if not include_drafts:
            query = query.where(Service.is_draft.is_(False))
        if format_mode:
            query = query.where(Service.format_mode == format_mode)
        query = query.order_by(Service.id.asc())
        services = db.scalars(query).all()
        data = [_service_to_public(item).model_dump(mode="json") for item in services]
        return JSONResponse(data)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Не удалось загрузить список услуг. Попробуйте позже.") from exc


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


@router.get("/events.php")
def legacy_events_php(db: Session = Depends(get_db_session)) -> JSONResponse:
    data = [item.model_dump(mode="json") for item in list_schedule(db=db)]
    return JSONResponse(data)


@router.get("/gallery", response_model=list[GalleryPublic])
def list_gallery(
    category: str | None = None,
    limit: int = Query(default=120, ge=1, le=500),
    db: Session = Depends(get_db_session),
) -> list[GalleryPublic]:
    query = select(GalleryItem).where(GalleryItem.is_active.is_(True))
    if category:
        query = query.where(GalleryItem.category == category)
    query = query.order_by(GalleryItem.sort_order.asc(), GalleryItem.id.desc()).limit(limit)
    return db.scalars(query).all()


@router.get("/legal", response_model=list[LegalPageResponse])
def list_legal_pages(db: Session = Depends(get_db_session)) -> list[LegalPageResponse]:
    pages: list[LegalPageResponse] = []
    for slug, payload in DEFAULT_LEGAL_PAGES.items():
        row = db.scalar(select(Setting).where(Setting.key == f"legal_{slug}"))
        if row and row.value:
            try:
                parsed = json.loads(row.value)
                pages.append(
                    LegalPageResponse(
                        slug=slug,
                        title=str(parsed.get("title") or payload["title"]),
                        content=str(parsed.get("content") or payload["content"]),
                    )
                )
                continue
            except Exception:
                pass

        pages.append(
            LegalPageResponse(
                slug=slug,
                title=payload["title"],
                content=payload["content"],
            )
        )

    return pages


@router.get("/legal/{slug}", response_model=LegalPageResponse)
def get_legal_page(slug: str, db: Session = Depends(get_db_session)) -> LegalPageResponse:
    default_payload = DEFAULT_LEGAL_PAGES.get(slug)
    if not default_payload:
        raise HTTPException(status_code=404, detail="Юридическая страница не найдена.")

    row = db.scalar(select(Setting).where(Setting.key == f"legal_{slug}"))
    if row and row.value:
        try:
            parsed = json.loads(row.value)
            return LegalPageResponse(
                slug=slug,
                title=str(parsed.get("title") or default_payload["title"]),
                content=str(parsed.get("content") or default_payload["content"]),
            )
        except Exception:
            pass

    return LegalPageResponse(
        slug=slug,
        title=default_payload["title"],
        content=default_payload["content"],
    )


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


@router.post("/submit_contact.php")
def legacy_submit_contact_php(
    name: str = Form(...),
    email: str = Form(...),
    phone: str | None = Form(default=None),
    message: str = Form(...),
    db: Session = Depends(get_db_session),
) -> JSONResponse:
    payload = ContactCreate(name=name, email=email, phone=phone, message=message)
    result = create_contact(payload=payload, db=db)
    return JSONResponse(result.model_dump(mode="json"))


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
    if event.current_participants >= event.max_participants:
        raise HTTPException(status_code=409, detail="Свободных мест больше нет.")

    if event.is_individual:
        amount = _extract_group_price(event.service, event)
        booking = Booking(
            schedule_event_id=event.id,
            name=payload.name.strip(),
            phone=payload.phone.strip(),
            email=str(payload.email),
            comment=(payload.comment or "").strip() or None,
            status="pending",
            payment_status="not_required",
            payment_amount=amount,
        )
        db.add(booking)
        db.commit()
        db.refresh(booking)
        return BookingCreateResponse(
            ok=True,
            booking_id=booking.id,
            payment_id=None,
            payment_status="not_required",
            confirmation_url=None,
            message="Заявка на индивидуальную практику создана. Администратор свяжется с вами для подтверждения.",
        )

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


@router.post("/certificate-purchase", response_model=GiftCertificatePurchaseResponse)
@router.post("/certificate-purchase/", response_model=GiftCertificatePurchaseResponse)
@router.post("/certificates/purchase", response_model=GiftCertificatePurchaseResponse)
@router.post("/certificates/purchase/", response_model=GiftCertificatePurchaseResponse)
def purchase_certificate(
    payload: GiftCertificatePurchaseRequest,
    db: Session = Depends(get_db_session),
) -> GiftCertificatePurchaseResponse:
    code = _generate_certificate_code(db)
    row = GiftCertificate(
        code=code,
        amount=payload.amount,
        recipient_name=(payload.recipient_name or "").strip() or None,
        sender_name=(payload.sender_name or "").strip() or None,
        note=(payload.note or "").strip() or None,
        buyer_name=payload.buyer_name.strip(),
        buyer_email=str(payload.buyer_email),
        buyer_phone=(payload.buyer_phone or "").strip() or None,
        status="paid",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return GiftCertificatePurchaseResponse(
        ok=True,
        certificate_id=row.id,
        certificate_code=row.code,
        status=row.status,
        public_url=_certificate_public_url(row.code),
        message="Оплата получена. Сертификат создан и будет оформлен администратором.",
    )


@router.get("/certificates/{code}", response_model=GiftCertificatePublicResponse)
def get_certificate(code: str, db: Session = Depends(get_db_session)) -> GiftCertificatePublicResponse:
    normalized_code = code.strip().upper()
    row = db.scalar(select(GiftCertificate).where(GiftCertificate.code == normalized_code))
    if not row:
        raise HTTPException(status_code=404, detail="Сертификат не найден.")
    return GiftCertificatePublicResponse(
        id=row.id,
        code=row.code,
        amount=row.amount,
        recipient_name=row.recipient_name,
        sender_name=row.sender_name,
        note=row.note,
        status=row.status,
        issued_by=row.issued_by,
        issued_at=row.issued_at,
        redeemed_at=row.redeemed_at,
        created_at=row.created_at,
    )


@router.get("/migration/status")
def migration_status() -> dict[str, list[str]]:
    return {
        "completed_now": [
            "FastAPI + SQLAlchemy (MySQL/SQLite)",
            "ЮKassa create/check/webhook",
            "Public API: site/services/schedule/gallery/legal/contacts",
            "Admin API: dashboard/services/schedule/gallery/bookings/contacts/settings/upload",
            "Gift certificates: public purchase/view + admin issue/redeem",
            "Legacy compatibility: /api/events.php and /api/submit_contact.php",
            "Dynamic SEO endpoints: /robots.txt and /sitemap.xml",
        ],
        "next_stage": [
            "JWT-авторизация админки (вместо token-header)",
            "Кеширование публичных read-эндпоинтов",
            "Расширенный SEO-рендер (SSR/SSG) и structured data",
        ],
    }
