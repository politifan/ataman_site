from __future__ import annotations

from app.db import Base, SessionLocal, engine
from app.security import ensure_bootstrap_admin
from app.models import Service, Setting
from seed_from_json import seed_gallery_assets, seed_schedule, seed_services, seed_site


def apply_runtime_content_fixes(db) -> None:
    # Sync phone in settings with actual contact requested by customer.
    contacts_row = db.query(Setting).filter(Setting.key == "contacts").one_or_none()
    if contacts_row and contacts_row.value:
        import json

        try:
            payload = json.loads(contacts_row.value)
        except Exception:
            payload = {}
        if not isinstance(payload, dict):
            payload = {}
        payload["phone"] = "+7 9377003500"
        contacts_row.value = json.dumps(payload, ensure_ascii=False)

    # Gong hammocks practice is also available in group format.
    hammocks = db.query(Service).filter(Service.slug == "gong-hammocks-meditation").one_or_none()
    if hammocks:
        hammocks.format_mode = "group_and_individual"


def main() -> None:
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        _, created = ensure_bootstrap_admin(db)
        if created:
            print("Bootstrap admin user created from .env")

        has_data = db.query(Service).count() > 0
        if not has_data:
            seed_site(db)
            service_map = seed_services(db)
            seed_schedule(db, service_map)
            seed_gallery_assets(db, service_map)
            db.commit()
            print("Database initialized and seeded.")
        else:
            seed_site(db)
            apply_runtime_content_fixes(db)
            db.commit()
            print("Database initialized. Seed skipped (services already exist).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
