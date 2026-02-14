from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ContactCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=32)
    message: str = Field(min_length=5, max_length=4000)


class BookingCreate(BaseModel):
    schedule_id: int
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=5, max_length=32)
    email: EmailStr
    comment: str | None = Field(default=None, max_length=1000)
    privacy_policy: bool = False
    personal_data: bool = False
    terms: bool = False


class BookingCreateResponse(BaseModel):
    ok: bool
    booking_id: int
    payment_id: str | None = None
    payment_status: str
    confirmation_url: str | None = None
    message: str


class SiteResponse(BaseModel):
    brand: str
    tagline: str
    subline: str
    home_image: str | None = None
    visual: dict[str, Any]
    contacts: dict[str, Any]
    organization: dict[str, Any] = Field(default_factory=dict)
    analytics: dict[str, Any] = Field(default_factory=dict)


class ServicePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    category: str | None = None
    category_label: str | None = None
    format_mode: str
    teaser: str | None = None
    duration: str | None = None
    pricing: dict[str, Any]
    about: list[str]
    suitable_for: list[str]
    host: dict[str, Any]
    important: list[str]
    dress_code: list[str]
    contraindications: list[str]
    media: list[str]
    age_restriction: str | None = None
    is_draft: bool
    is_active: bool


class SchedulePublic(BaseModel):
    id: int
    service_id: int
    service_slug: str
    service_title: str
    start_time: datetime
    end_time: datetime
    max_participants: int
    current_participants: int
    available_spots: int
    is_individual: bool
    is_active: bool


class PaymentStatusResponse(BaseModel):
    payment_id: str
    status: str
    booking_status: str
    redirect_url: str | None = None


class ServiceAdminBase(BaseModel):
    slug: str = Field(min_length=2, max_length=120)
    title: str = Field(min_length=2, max_length=255)
    category: str | None = Field(default=None, max_length=64)
    category_label: str | None = Field(default=None, max_length=128)
    format_mode: str = Field(default="group_and_individual", pattern="^(group_and_individual|individual_only)$")
    teaser: str | None = None
    duration: str | None = Field(default=None, max_length=64)
    pricing: dict[str, Any] = Field(default_factory=dict)
    about: list[str] = Field(default_factory=list)
    suitable_for: list[str] = Field(default_factory=list)
    host: dict[str, Any] = Field(default_factory=dict)
    important: list[str] = Field(default_factory=list)
    dress_code: list[str] = Field(default_factory=list)
    contraindications: list[str] = Field(default_factory=list)
    media: list[str] = Field(default_factory=list)
    age_restriction: str | None = Field(default=None, max_length=32)
    is_draft: bool = False
    is_active: bool = True

    @field_validator(
        "pricing",
        "host",
        mode="before",
    )
    @classmethod
    def _normalize_dict_fields(cls, value: Any) -> dict[str, Any]:
        if value is None or not isinstance(value, dict):
            return {}
        return value

    @field_validator(
        "about",
        "suitable_for",
        "important",
        "dress_code",
        "contraindications",
        "media",
        mode="before",
    )
    @classmethod
    def _normalize_list_fields(cls, value: Any) -> list[Any]:
        if value is None:
            return []
        if isinstance(value, list):
            return value
        return []


class ServiceAdminCreate(ServiceAdminBase):
    pass


class ServiceAdminUpdate(ServiceAdminBase):
    pass


class ServiceAdminResponse(ServiceAdminBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class ScheduleAdminBase(BaseModel):
    service_id: int
    start_time: datetime
    end_time: datetime
    max_participants: int = Field(default=1, ge=1)
    current_participants: int = Field(default=0, ge=0)
    is_individual: bool = False
    is_active: bool = True


class ScheduleAdminCreate(ScheduleAdminBase):
    pass


class ScheduleAdminUpdate(ScheduleAdminBase):
    pass


class ScheduleAdminResponse(ScheduleAdminBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime
    service_title: str | None = None
    service_slug: str | None = None


class GalleryAdminBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    image_path: str = Field(min_length=1, max_length=512)
    category: str | None = Field(default=None, max_length=80)
    sort_order: int = 0
    is_active: bool = True


class GalleryAdminCreate(GalleryAdminBase):
    pass


class GalleryAdminUpdate(GalleryAdminBase):
    pass


class GalleryAdminResponse(GalleryAdminBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class PaymentWebhookEnvelope(BaseModel):
    event: str
    object: dict[str, Any]


class PaymentCreatePayload(BaseModel):
    booking_id: int
    amount: Decimal
    description: str


class ContactResponse(BaseModel):
    ok: bool
    id: int
    message: str


class GalleryPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None = None
    image_path: str
    category: str | None = None
    sort_order: int
    is_active: bool


class LegalPageResponse(BaseModel):
    slug: str
    title: str
    content: str


class BookingAdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    schedule_event_id: int
    service_title: str | None = None
    service_slug: str | None = None
    event_start_time: datetime | None = None
    event_end_time: datetime | None = None
    name: str
    phone: str
    email: str
    comment: str | None = None
    status: str
    payment_status: str
    payment_id: str | None = None
    payment_amount: Decimal | None = None
    payment_confirmation_url: str | None = None
    paid_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class BookingAdminStatusUpdate(BaseModel):
    status: str = Field(pattern="^(pending|waiting_payment|confirmed|cancelled)$")


class ContactAdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: str | None = None
    message: str
    status: str
    created_at: datetime
    updated_at: datetime


class ContactAdminStatusUpdate(BaseModel):
    status: str = Field(pattern="^(new|read|replied)$")


class SettingAdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str
    value: str | None = None
    is_public: bool
    created_at: datetime
    updated_at: datetime


class SettingUpdateItem(BaseModel):
    key: str = Field(min_length=1, max_length=128)
    value: str | None = None
    is_public: bool = True


class SettingBulkUpdate(BaseModel):
    items: list[SettingUpdateItem] = Field(default_factory=list)


class AdminDashboardStatsResponse(BaseModel):
    services: int
    schedule_events: int
    bookings_total: int
    bookings_pending: int
    contacts_new: int
    gallery_items: int


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=200)


class AdminAuthUser(BaseModel):
    id: int | None = None
    username: str
    role: str
    is_active: bool = True


class AdminAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AdminAuthUser


class AdminMeResponse(BaseModel):
    user: AdminAuthUser
    auth_type: str
