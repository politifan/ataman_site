from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

from app.db import SessionLocal
from app.models import Booking, Contact, GalleryItem, Payment, PaymentLog, ScheduleEvent, Service, Setting

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def upsert_setting(db, key: str, value: str, *, is_public: bool = True) -> None:
    row = db.query(Setting).filter(Setting.key == key).one_or_none()
    if row:
        row.value = value
        row.is_public = is_public
    else:
        db.add(Setting(key=key, value=value, is_public=is_public))


def seed_site(db) -> None:
    site = load_json(DATA_DIR / "site.json")
    upsert_setting(db, "brand", site.get("brand", ""))
    upsert_setting(db, "tagline", site.get("tagline", ""))
    upsert_setting(db, "subline", site.get("subline", ""))
    upsert_setting(db, "home_image", site.get("home_image", ""))
    upsert_setting(db, "visual", json.dumps(site.get("visual", {}), ensure_ascii=False))
    upsert_setting(db, "contacts", json.dumps(site.get("contacts", {}), ensure_ascii=False))


def seed_services(db) -> dict[str, Service]:
    services_data = load_json(DATA_DIR / "services.json")
    service_by_slug: dict[str, Service] = {}
    for payload in services_data:
        slug = payload["slug"]
        row = db.query(Service).filter(Service.slug == slug).one_or_none()
        clean_payload = {
            key: payload.get(key)
            for key in [
                "slug",
                "title",
                "category",
                "category_label",
                "format_mode",
                "teaser",
                "duration",
                "pricing",
                "about",
                "suitable_for",
                "host",
                "important",
                "dress_code",
                "contraindications",
                "media",
                "age_restriction",
                "is_draft",
            ]
        }
        clean_payload["is_active"] = True
        if row:
            for key, value in clean_payload.items():
                setattr(row, key, value)
        else:
            row = Service(**clean_payload)
            db.add(row)
        service_by_slug[slug] = row

    db.flush()
    return service_by_slug


def seed_schedule(db, service_by_slug: dict[str, Service]) -> None:
    events_data = load_json(DATA_DIR / "schedule.json")
    for payload in events_data:
        slug = payload.get("service_slug")
        service = service_by_slug.get(slug)
        if not service:
            continue
        row = db.query(ScheduleEvent).filter(ScheduleEvent.id == payload["id"]).one_or_none()
        values = {
            "service_id": service.id,
            "start_time": datetime.fromisoformat(payload["start_time"]),
            "end_time": datetime.fromisoformat(payload["end_time"]),
            "max_participants": int(payload.get("max_participants", 1)),
            "current_participants": int(payload.get("current_participants", 0)),
            "is_individual": bool(payload.get("is_individual", False)),
            "is_active": bool(payload.get("is_active", True)),
        }
        if row:
            for key, value in values.items():
                setattr(row, key, value)
        else:
            db.add(ScheduleEvent(id=payload["id"], **values))


def seed_gallery_stub(db) -> None:
    reference_title = "Референс главной"
    reference_path = "referens_oformleniya_uslugi_1.png"

    existing_reference = db.query(GalleryItem).filter(GalleryItem.title == reference_title).one_or_none()
    if existing_reference:
        existing_reference.image_path = reference_path
        existing_reference.category = "reference"
        existing_reference.is_active = True
        return

    if db.query(GalleryItem).count() > 0:
        return
    db.add(
        GalleryItem(
            title=reference_title,
            description="Материал из папки проекта",
            image_path=reference_path,
            category="reference",
            sort_order=0,
            is_active=True,
        )
    )


def maybe_reset(db, reset: bool) -> None:
    if not reset:
        return
    db.query(PaymentLog).delete()
    db.query(Payment).delete()
    db.query(Booking).delete()
    db.query(ScheduleEvent).delete()
    db.query(Contact).delete()
    db.query(Service).delete()
    db.query(GalleryItem).delete()
    db.query(Setting).delete()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed MySQL from app/backend/data JSON files.")
    parser.add_argument("--reset", action="store_true", help="Очистить сервисы/расписание/настройки перед импортом.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        maybe_reset(db, args.reset)
        seed_site(db)
        service_map = seed_services(db)
        seed_schedule(db, service_map)
        seed_gallery_stub(db)
        db.commit()
        print("Seed completed.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
