from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Setting(TimestampMixin, Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    value: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class AdminUser(TimestampMixin, Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="admin", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Service(TimestampMixin, Base):
    __tablename__ = "services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(String(64), nullable=True)
    category_label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    format_mode: Mapped[str] = mapped_column(String(32), default="group_and_individual", nullable=False)
    teaser: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration: Mapped[str | None] = mapped_column(String(64), nullable=True)

    pricing: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    about: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    suitable_for: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    host: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    important: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    dress_code: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    contraindications: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    media: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    age_restriction: Mapped[str | None] = mapped_column(String(32), nullable=True)
    is_draft: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    schedules: Mapped[list["ScheduleEvent"]] = relationship(
        back_populates="service",
        cascade="all, delete-orphan",
    )


class ScheduleEvent(TimestampMixin, Base):
    __tablename__ = "schedule_events"
    __table_args__ = (
        Index("ix_schedule_service_start", "service_id", "start_time"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id", ondelete="CASCADE"), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    max_participants: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    current_participants: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_individual: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    service: Mapped["Service"] = relationship(back_populates="schedules")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="schedule_event")


class Contact(TimestampMixin, Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="new", nullable=False)


class Booking(TimestampMixin, Base):
    __tablename__ = "bookings"
    __table_args__ = (
        Index("ix_bookings_schedule_status", "schedule_event_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    schedule_event_id: Mapped[int] = mapped_column(
        ForeignKey("schedule_events.id", ondelete="RESTRICT"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False)
    payment_status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False)
    payment_id: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    payment_amount: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    payment_confirmation_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    schedule_event: Mapped["ScheduleEvent"] = relationship(back_populates="bookings")
    payment: Mapped["Payment"] = relationship(back_populates="booking", uselist=False)


class Payment(TimestampMixin, Base):
    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("provider_payment_id", name="uq_provider_payment_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    provider: Mapped[str] = mapped_column(String(32), default="yookassa", nullable=False)
    provider_payment_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="RUB", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String(64), nullable=True)
    confirmation_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    raw_payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    booking: Mapped["Booking"] = relationship(back_populates="payment")
    logs: Mapped[list["PaymentLog"]] = relationship(back_populates="payment", cascade="all, delete-orphan")


class PaymentLog(Base):
    __tablename__ = "payment_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    payment_id: Mapped[int] = mapped_column(ForeignKey("payments.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    payment: Mapped["Payment"] = relationship(back_populates="logs")


class GalleryItem(TimestampMixin, Base):
    __tablename__ = "gallery_items"
    __table_args__ = (
        Index("ix_gallery_category_active", "category", "is_active"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_path: Mapped[str] = mapped_column(String(512), nullable=False)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
