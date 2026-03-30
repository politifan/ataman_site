from __future__ import annotations

from app.db_migrations import (
    backfill_gift_certificate_validity,
    ensure_gift_certificate_validity_schema,
    ensure_service_payment_mode_schema,
)
from app.db import Base, SessionLocal, engine
from app.security import ensure_bootstrap_admin
from app.services.runtime_settings import ensure_runtime_settings
from app.models import Service
from seed_from_json import seed_gallery_assets, seed_press_videos, seed_schedule, seed_services, seed_site


def apply_runtime_content_fixes(db) -> None:
    # Gong hammocks practice is also available in group format.
    hammocks = db.query(Service).filter(Service.slug == "gong-hammocks-meditation").one_or_none()
    if hammocks:
        hammocks.format_mode = "group_and_individual"


def main() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_service_payment_mode_schema(engine)
    ensure_gift_certificate_validity_schema(engine)

    db = SessionLocal()
    try:
        _, created = ensure_bootstrap_admin(db)
        ensure_runtime_settings(db)
        if created:
            print("Bootstrap admin user created from .env")

        has_data = db.query(Service).count() > 0
        if not has_data:
            seed_site(db)
            service_map = seed_services(db)
            seed_schedule(db, service_map)
            seed_gallery_assets(db, service_map)
            seed_press_videos(db)
            db.commit()
            backfill_gift_certificate_validity(db)
            print("Database initialized and seeded.")
        else:
            # Preserve admin-edited settings on redeploy; only create missing keys from defaults.
            seed_site(db, overwrite=False)
            # Reconcile JSON source-of-truth into existing DB so new services and slots
            # are added on redeploy without requiring a full reset.
            service_map = seed_services(db)
            seed_schedule(db, service_map)
            seed_press_videos(db)
            apply_runtime_content_fixes(db)
            db.commit()
            backfill_gift_certificate_validity(db)
            print("Database initialized. Existing content reconciled.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
