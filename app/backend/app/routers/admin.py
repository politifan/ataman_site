from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..deps import get_db_session, require_admin
from ..models import GalleryItem, ScheduleEvent, Service
from ..schemas import (
    GalleryAdminCreate,
    GalleryAdminResponse,
    GalleryAdminUpdate,
    ScheduleAdminCreate,
    ScheduleAdminResponse,
    ScheduleAdminUpdate,
    ServiceAdminCreate,
    ServiceAdminResponse,
    ServiceAdminUpdate,
)

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/services", response_model=list[ServiceAdminResponse])
def admin_list_services(db: Session = Depends(get_db_session)) -> list[Service]:
    return db.scalars(select(Service).order_by(Service.id.asc())).all()


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
