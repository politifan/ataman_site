from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from decimal import Decimal
from uuid import uuid4

import httpx
from fastapi import HTTPException

from ..config import settings

YOOKASSA_API_BASE = "https://api.yookassa.ru/v3"


@dataclass
class YookassaPaymentResult:
    payment_id: str
    status: str
    confirmation_url: str | None
    payment_method: str | None
    payload: dict


class YookassaClient:
    def __init__(self) -> None:
        if not settings.yookassa_enabled:
            raise HTTPException(
                status_code=503,
                detail="ЮKassa не настроена (YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY).",
            )
        self.shop_id = settings.yookassa_shop_id or ""
        self.secret_key = settings.yookassa_secret_key or ""
        token = base64.b64encode(f"{self.shop_id}:{self.secret_key}".encode("utf-8")).decode("utf-8")
        self.auth_header = f"Basic {token}"

    def _request(self, method: str, path: str, *, payload: dict | None = None) -> dict:
        headers = {
            "Authorization": self.auth_header,
            "Content-Type": "application/json",
        }
        if method.upper() == "POST":
            headers["Idempotence-Key"] = str(uuid4())

        with httpx.Client(timeout=20.0) as client:
            response = client.request(
                method=method,
                url=f"{YOOKASSA_API_BASE}{path}",
                headers=headers,
                json=payload,
            )

        if response.status_code >= 400:
            raise HTTPException(
                status_code=502,
                detail=f"Ошибка ЮKassa: {response.status_code} {response.text}",
            )
        return response.json()

    def create_payment(self, *, booking_id: int, amount: Decimal, description: str) -> YookassaPaymentResult:
        body = {
            "amount": {
                "value": f"{amount:.2f}",
                "currency": "RUB",
            },
            "capture": True,
            "confirmation": {
                "type": "redirect",
                "return_url": settings.yookassa_return_url,
            },
            "description": description,
            "metadata": {
                "booking_id": str(booking_id),
            },
        }
        payload = self._request("POST", "/payments", payload=body)
        return YookassaPaymentResult(
            payment_id=payload["id"],
            status=payload["status"],
            confirmation_url=(payload.get("confirmation") or {}).get("confirmation_url"),
            payment_method=(payload.get("payment_method") or {}).get("type"),
            payload=payload,
        )

    def get_payment(self, payment_id: str) -> YookassaPaymentResult:
        payload = self._request("GET", f"/payments/{payment_id}")
        return YookassaPaymentResult(
            payment_id=payload["id"],
            status=payload["status"],
            confirmation_url=(payload.get("confirmation") or {}).get("confirmation_url"),
            payment_method=(payload.get("payment_method") or {}).get("type"),
            payload=payload,
        )


def verify_legacy_signature(raw_body: bytes, signature: str | None) -> bool:
    """Совместимость со старой подписью X-Payment-Sha1-Hash."""
    if not settings.yookassa_webhook_secret:
        return True
    if not signature:
        return False

    expected = hmac.new(
        key=settings.yookassa_webhook_secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha1,
    ).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


def safe_json_loads(raw_body: bytes) -> dict:
    try:
        return json.loads(raw_body.decode("utf-8"))
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=400, detail=f"Невалидный JSON webhook: {exc}") from exc
