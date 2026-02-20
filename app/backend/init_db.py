from __future__ import annotations

from app.db import Base, SessionLocal, engine
from app.security import ensure_bootstrap_admin
from app.models import Service
from seed_from_json import seed_gallery_assets, seed_schedule, seed_services, seed_site


def apply_runtime_content_fixes(db) -> None:
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
            # Preserve admin-edited settings on redeploy; only create missing keys from defaults.
            seed_site(db, overwrite=False)
            apply_runtime_content_fixes(db)
            db.commit()
            print("Database initialized. Seed skipped (services already exist).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
