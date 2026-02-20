from __future__ import annotations

import secrets
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from ..config import settings
from ..deps import get_db_session, require_admin
from ..models import Booking, Contact, GalleryItem, GiftCertificate, ScheduleEvent, Service, Setting
from ..schemas import (
    AdminDashboardStatsResponse,
    BookingAdminResponse,
    BookingAdminStatusUpdate,
    ContactAdminResponse,
    ContactAdminStatusUpdate,
    GiftCertificateAdminResponse,
    GiftCertificateAdminUpdate,
    GalleryAdminCreate,
    GalleryAdminResponse,
    GalleryAdminUpdate,
    ScheduleAdminCreate,
    ScheduleAdminResponse,
    ScheduleAdminUpdate,
    ServiceAdminCreate,
    ServiceAdminResponse,
    ServiceAdminUpdate,
    SettingAdminResponse,
    SettingBulkUpdate,
    SettingUpdateItem,
)

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _resolve_media_root(raw_path: str) -> Path | None:
    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate if candidate.exists() else None

    here = Path(__file__).resolve()
    search_roots = [
        here.parent,  # app/backend/app/routers
        here.parent.parent,  # app/backend/app
        here.parent.parent.parent,  # app/backend
        here.parent.parent.parent.parent,  # app
        here.parent.parent.parent.parent.parent,  # project root
    ]
    for root in search_roots:
        resolved = (root / candidate).resolve()
        if resolved.exists():
            return resolved
    return None


def _serialize_booking(row: Booking) -> BookingAdminResponse:
    event = row.schedule_event
    service = event.service if event else None
    return BookingAdminResponse(
        id=row.id,
        schedule_event_id=row.schedule_event_id,
        service_title=service.title if service else None,
        service_slug=service.slug if service else None,
        event_start_time=event.start_time if event else None,
        event_end_time=event.end_time if event else None,
        name=row.name,
        phone=row.phone,
        email=row.email,
        comment=row.comment,
        status=row.status,
        payment_status=row.payment_status,
        payment_id=row.payment_id,
        payment_amount=row.payment_amount,
        payment_confirmation_url=row.payment_confirmation_url,
        paid_at=row.paid_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/dashboard", response_model=AdminDashboardStatsResponse)
def admin_dashboard_stats(db: Session = Depends(get_db_session)) -> AdminDashboardStatsResponse:
    return AdminDashboardStatsResponse(
        services=int(db.scalar(select(func.count(Service.id))) or 0),
        schedule_events=int(db.scalar(select(func.count(ScheduleEvent.id))) or 0),
        bookings_total=int(db.scalar(select(func.count(Booking.id))) or 0),
        bookings_pending=int(
            db.scalar(select(func.count(Booking.id)).where(Booking.status.in_(("pending", "waiting_payment")))) or 0
        ),
        contacts_new=int(db.scalar(select(func.count(Contact.id)).where(Contact.status == "new")) or 0),
        gallery_items=int(db.scalar(select(func.count(GalleryItem.id))) or 0),
    )


def _admin_services_payload(db: Session) -> list[dict[str, Any]]:
    rows = db.scalars(select(Service).order_by(Service.id.asc())).all()
    return [_service_to_admin(row).model_dump(mode="json") for row in rows]


@router.get("/services", response_model=None)
def admin_list_services(db: Session = Depends(get_db_session)) -> JSONResponse:
    try:
        return JSONResponse(_admin_services_payload(db))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"/api/admin/services failed: {type(exc).__name__}: {exc}") from exc


@router.get("/services-list", response_model=None)
def admin_list_services_fallback(db: Session = Depends(get_db_session)) -> JSONResponse:
    try:
        return JSONResponse(_admin_services_payload(db))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"/api/admin/services-list failed: {type(exc).__name__}: {exc}") from exc


@router.post("/services", response_model=ServiceAdminResponse)
def admin_create_service(payload: ServiceAdminCreate, db: Session = Depends(get_db_session)) -> Service:
    exists = db.scalar(select(Service).where(Service.slug == payload.slug))
    if exists:
        raise HTTPException(status_code=409, detail="Услуга с таким slug уже существует.")
    row = Service(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/services/{service_id}", response_model=ServiceAdminResponse)
def admin_update_service(service_id: int, payload: ServiceAdminUpdate, db: Session = Depends(get_db_session)) -> Service:
    row = db.get(Service, service_id)
    if not row:
        raise HTTPException(status_code=404, detail="Услуга не найдена.")

    other = db.scalar(select(Service).where(Service.slug == payload.slug, Service.id != service_id))
    if other:
        raise HTTPException(status_code=409, detail="Slug уже используется другой услугой.")

    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/services/{service_id}")
def admin_delete_service(service_id: int, db: Session = Depends(get_db_session)) -> dict[str, bool]:
    row = db.get(Service, service_id)
    if not row:
        raise HTTPException(status_code=404, detail="Услуга не найдена.")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/schedule", response_model=list[ScheduleAdminResponse])
def admin_list_schedule(db: Session = Depends(get_db_session)) -> list[ScheduleAdminResponse]:
    rows = db.scalars(
        select(ScheduleEvent)
        .options(joinedload(ScheduleEvent.service))
        .order_by(ScheduleEvent.start_time.asc())
    ).all()
    result: list[ScheduleAdminResponse] = []
    for item in rows:
        result.append(
            ScheduleAdminResponse(
                id=item.id,
                service_id=item.service_id,
                service_title=item.service.title if item.service else None,
                service_slug=item.service.slug if item.service else None,
                start_time=item.start_time,
                end_time=item.end_time,
                max_participants=item.max_participants,
                current_participants=item.current_participants,
                is_individual=item.is_individual,
                is_active=item.is_active,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
        )
    return result


@router.post("/schedule", response_model=ScheduleAdminResponse)
def admin_create_schedule(payload: ScheduleAdminCreate, db: Session = Depends(get_db_session)) -> ScheduleAdminResponse:
    service = db.get(Service, payload.service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена.")
    row = ScheduleEvent(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return ScheduleAdminResponse(
        id=row.id,
        service_id=row.service_id,
        service_title=service.title,
        service_slug=service.slug,
        start_time=row.start_time,
        end_time=row.end_time,
        max_participants=row.max_participants,
        current_participants=row.current_participants,
        is_individual=row.is_individual,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.put("/schedule/{event_id}", response_model=ScheduleAdminResponse)
def admin_update_schedule(
    event_id: int,
    payload: ScheduleAdminUpdate,
    db: Session = Depends(get_db_session),
) -> ScheduleAdminResponse:
    row = db.get(ScheduleEvent, event_id)
    if not row:
        raise HTTPException(status_code=404, detail="Событие не найдено.")

    service = db.get(Service, payload.service_id)
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена.")

    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return ScheduleAdminResponse(
        id=row.id,
        service_id=row.service_id,
        service_title=service.title,
        service_slug=service.slug,
        start_time=row.start_time,
        end_time=row.end_time,
        max_participants=row.max_participants,
        current_participants=row.current_participants,
        is_individual=row.is_individual,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.delete("/schedule/{event_id}")
def admin_delete_schedule(event_id: int, db: Session = Depends(get_db_session)) -> dict[str, bool]:
    row = db.get(ScheduleEvent, event_id)
    if not row:
        raise HTTPException(status_code=404, detail="Событие не найдено.")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/gallery", response_model=list[GalleryAdminResponse])
def admin_list_gallery(db: Session = Depends(get_db_session)) -> list[GalleryItem]:
    return db.scalars(select(GalleryItem).order_by(GalleryItem.sort_order.asc(), GalleryItem.id.desc())).all()


@router.post("/gallery", response_model=GalleryAdminResponse)
def admin_create_gallery(payload: GalleryAdminCreate, db: Session = Depends(get_db_session)) -> GalleryItem:
    row = GalleryItem(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/gallery/{item_id}", response_model=GalleryAdminResponse)
def admin_update_gallery(item_id: int, payload: GalleryAdminUpdate, db: Session = Depends(get_db_session)) -> GalleryItem:
    row = db.get(GalleryItem, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Элемент галереи не найден.")
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/gallery/{item_id}")
def admin_delete_gallery(item_id: int, db: Session = Depends(get_db_session)) -> dict[str, bool]:
    row = db.get(GalleryItem, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Элемент галереи не найден.")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/bookings", response_model=list[BookingAdminResponse])
def admin_list_bookings(
    status: str | None = None,
    service_id: int | None = None,
    search: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db_session),
) -> list[BookingAdminResponse]:
    query = (
        select(Booking)
        .join(ScheduleEvent, Booking.schedule_event_id == ScheduleEvent.id)
        .join(Service, ScheduleEvent.service_id == Service.id)
        .options(joinedload(Booking.schedule_event).joinedload(ScheduleEvent.service))
        .order_by(Booking.created_at.desc())
    )

    if status:
        query = query.where(Booking.status == status)
    if service_id:
        query = query.where(ScheduleEvent.service_id == service_id)
    if search:
        like = f"%{search.strip()}%"
        query = query.where(
            or_(
                Booking.name.ilike(like),
                Booking.phone.ilike(like),
                Booking.email.ilike(like),
                Booking.payment_id.ilike(like),
                Service.title.ilike(like),
            )
        )
    if date_from:
        query = query.where(ScheduleEvent.start_time >= date_from)
    if date_to:
        query = query.where(ScheduleEvent.start_time <= date_to)

    rows = db.scalars(query).all()
    return [_serialize_booking(row) for row in rows]


@router.patch("/bookings/{booking_id}/status", response_model=BookingAdminResponse)
def admin_update_booking_status(
    booking_id: int,
    payload: BookingAdminStatusUpdate,
    db: Session = Depends(get_db_session),
) -> BookingAdminResponse:
    row = db.scalar(
        select(Booking)
        .options(joinedload(Booking.schedule_event).joinedload(ScheduleEvent.service))
        .where(Booking.id == booking_id)
    )
    if not row:
        raise HTTPException(status_code=404, detail="Бронирование не найдено.")

    old_status = row.status
    new_status = payload.status
    event = row.schedule_event

    if old_status != "confirmed" and new_status == "confirmed" and event:
        if event.current_participants >= event.max_participants:
            raise HTTPException(status_code=409, detail="Невозможно подтвердить: мест больше нет.")
        event.current_participants += 1

    if old_status == "confirmed" and new_status != "confirmed" and event and event.current_participants > 0:
        event.current_participants -= 1

    row.status = new_status
    if new_status == "confirmed" and row.payment_status in {"pending", "waiting_payment"}:
        row.payment_status = "paid"
    if new_status == "cancelled" and row.payment_status != "paid":
        row.payment_status = "failed"

    db.commit()
    db.refresh(row)
    return _serialize_booking(row)


@router.delete("/bookings/{booking_id}")
def admin_delete_booking(booking_id: int, db: Session = Depends(get_db_session)) -> dict[str, bool]:
    row = db.scalar(select(Booking).options(joinedload(Booking.schedule_event)).where(Booking.id == booking_id))
    if not row:
        raise HTTPException(status_code=404, detail="Бронирование не найдено.")

    event = row.schedule_event
    if row.status == "confirmed" and event and event.current_participants > 0:
        event.current_participants -= 1

    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/contacts", response_model=list[ContactAdminResponse])
def admin_list_contacts(
    status: str | None = None,
    search: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db_session),
) -> list[Contact]:
    query = select(Contact).order_by(Contact.created_at.desc())
    if status:
        query = query.where(Contact.status == status)
    if search:
        like = f"%{search.strip()}%"
        query = query.where(
            or_(
                Contact.name.ilike(like),
                Contact.email.ilike(like),
                Contact.phone.ilike(like),
                Contact.message.ilike(like),
            )
        )
    if date_from:
        query = query.where(Contact.created_at >= date_from)
    if date_to:
        query = query.where(Contact.created_at <= date_to)
    return db.scalars(query).all()


@router.patch("/contacts/{contact_id}/status", response_model=ContactAdminResponse)
def admin_update_contact_status(
    contact_id: int,
    payload: ContactAdminStatusUpdate,
    db: Session = Depends(get_db_session),
) -> Contact:
    row = db.get(Contact, contact_id)
    if not row:
        raise HTTPException(status_code=404, detail="Сообщение не найдено.")
    row.status = payload.status
    db.commit()
    db.refresh(row)
    return row


@router.delete("/contacts/{contact_id}")
def admin_delete_contact(contact_id: int, db: Session = Depends(get_db_session)) -> dict[str, bool]:
    row = db.get(Contact, contact_id)
    if not row:
        raise HTTPException(status_code=404, detail="Сообщение не найдено.")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/settings", response_model=list[SettingAdminResponse])
def admin_list_settings(db: Session = Depends(get_db_session)) -> list[Setting]:
    return db.scalars(select(Setting).order_by(Setting.key.asc())).all()


@router.put("/settings", response_model=list[SettingAdminResponse])
def admin_update_settings(
    payload: SettingBulkUpdate | list[SettingUpdateItem],
    db: Session = Depends(get_db_session),
) -> list[Setting]:
    items = payload.items if isinstance(payload, SettingBulkUpdate) else payload
    if not items:
        raise HTTPException(status_code=422, detail="Список settings пуст.")

    for item in items:
        row = db.scalar(select(Setting).where(Setting.key == item.key))
        if row:
            row.value = item.value
            row.is_public = item.is_public
        else:
            db.add(Setting(key=item.key, value=item.value, is_public=item.is_public))

    db.commit()
    return db.scalars(select(Setting).order_by(Setting.key.asc())).all()


@router.delete("/settings/{key}")
def admin_delete_setting(key: str, db: Session = Depends(get_db_session)) -> dict[str, bool]:
    row = db.scalar(select(Setting).where(Setting.key == key))
    if not row:
        raise HTTPException(status_code=404, detail="Настройка не найдена.")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/certificates", response_model=list[GiftCertificateAdminResponse])
def admin_list_certificates(
    status: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db_session),
) -> list[GiftCertificate]:
    query = select(GiftCertificate).order_by(GiftCertificate.created_at.desc())
    if status:
        query = query.where(GiftCertificate.status == status)
    if search:
        like = f"%{search.strip()}%"
        query = query.where(
            or_(
                GiftCertificate.code.ilike(like),
                GiftCertificate.recipient_name.ilike(like),
                GiftCertificate.sender_name.ilike(like),
                GiftCertificate.buyer_name.ilike(like),
                GiftCertificate.buyer_email.ilike(like),
                GiftCertificate.buyer_phone.ilike(like),
            )
        )
    return db.scalars(query).all()


@router.patch("/certificates/{certificate_id}", response_model=GiftCertificateAdminResponse)
def admin_update_certificate(
    certificate_id: int,
    payload: GiftCertificateAdminUpdate,
    db: Session = Depends(get_db_session),
) -> GiftCertificate:
    row = db.get(GiftCertificate, certificate_id)
    if not row:
        raise HTTPException(status_code=404, detail="Сертификат не найден.")

    updates = payload.model_dump(exclude_unset=True)
    next_status = updates.get("status")
    now = datetime.utcnow()

    for key, value in updates.items():
        setattr(row, key, value)

    if next_status == "issued" and row.issued_at is None:
        row.issued_at = now

    if next_status == "redeemed" and row.redeemed_at is None:
        row.redeemed_at = now
    if next_status == "redeemed" and row.issued_at is None:
        row.issued_at = now
    if next_status in {"paid", "issued", "cancelled"}:
        row.redeemed_at = None

    db.commit()
    db.refresh(row)
    return row


@router.post("/upload")
async def admin_upload_file(
    file: UploadFile = File(...),
    target: str = Form(default="gallery"),
) -> dict[str, str | bool]:
    media_root = _resolve_media_root(settings.media_root)
    if not media_root:
        raise HTTPException(status_code=500, detail="MEDIA_ROOT не найден на сервере.")

    allowed_targets = {"gallery", "services", "general", "icons"}
    if target not in allowed_targets:
        raise HTTPException(status_code=422, detail="Недопустимый target для загрузки.")

    filename = file.filename or ""
    ext = Path(filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".mp4", ".webm", ".mov"}:
        raise HTTPException(status_code=422, detail="Недопустимый формат файла.")

    content = await file.read()
    max_size = 30 * 1024 * 1024
    if len(content) > max_size:
        raise HTTPException(status_code=422, detail="Файл слишком большой (макс. 30MB).")

    relative_dir = Path("uploads") / target
    save_dir = media_root / relative_dir
    save_dir.mkdir(parents=True, exist_ok=True)

    unique_name = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(4)}{ext}"
    save_path = save_dir / unique_name
    save_path.write_bytes(content)

    relative_path = (relative_dir / unique_name).as_posix()
    return {
        "ok": True,
        "path": relative_path,
        "url": f"/media/{relative_path}",
    }
def _service_to_admin(service: Service) -> ServiceAdminResponse:
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
        "format_mode": service.format_mode or "group_and_individual",
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
        "created_at": service.created_at,
        "updated_at": service.updated_at,
    }
    return ServiceAdminResponse.model_validate(payload)
