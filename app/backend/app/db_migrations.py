from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from .certificates import DEFAULT_VALIDITY_MODE, calculate_certificate_expires_at, normalize_certificate_validity
from .models import GiftCertificate


def ensure_gift_certificate_validity_schema(engine: Engine) -> None:
    inspector = inspect(engine)
    if "gift_certificates" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("gift_certificates")}
    statements: list[str] = []

    if "validity_mode" not in existing_columns:
        statements.append(
            f"ALTER TABLE gift_certificates ADD COLUMN validity_mode VARCHAR(24) NOT NULL DEFAULT '{DEFAULT_VALIDITY_MODE}'"
        )
    if "validity_days" not in existing_columns:
        statements.append("ALTER TABLE gift_certificates ADD COLUMN validity_days INTEGER")
    if "expires_at" not in existing_columns:
        statements.append("ALTER TABLE gift_certificates ADD COLUMN expires_at DATETIME")
    if "sender_hidden" not in existing_columns:
        statements.append("ALTER TABLE gift_certificates ADD COLUMN sender_hidden BOOLEAN NOT NULL DEFAULT 0")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def backfill_gift_certificate_validity(db: Session) -> None:
    rows = db.query(GiftCertificate).all()
    changed = False

    for row in rows:
        mode, days = normalize_certificate_validity(row.validity_mode, row.validity_days)

        if row.validity_mode != mode:
            row.validity_mode = mode
            changed = True
        if row.validity_days != days:
            row.validity_days = days
            changed = True
        if row.sender_hidden is None:
            row.sender_hidden = False
            changed = True

        if row.issued_at and row.expires_at is None:
            row.expires_at = calculate_certificate_expires_at(row.issued_at, mode, days)
            changed = True

    if changed:
        db.commit()
