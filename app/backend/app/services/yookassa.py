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

from .runtime_settings import RuntimePaymentSettings

YOOKASSA_API_BASE = "https://api.yookassa.ru/v3"


@dataclass
class YookassaPaymentResult:
    payment_id: str
    status: str
    confirmation_url: str | None
    payment_method: str | None
    payload: dict


class YookassaClient:
    def __init__(self, runtime: RuntimePaymentSettings) -> None:
        if not runtime.enabled:
            raise HTTPException(
                status_code=503,
                detail="Онлайн-оплата временно недоступна. Попробуйте позже или свяжитесь с нами.",
            )
        self.runtime = runtime
        self.shop_id = runtime.shop_id
        self.secret_key = runtime.secret_key
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
                detail="Не удалось создать платеж. Попробуйте еще раз чуть позже.",
            )
        return response.json()

    def create_payment(
        self,
        *,
        booking_id: int,
        amount: Decimal,
        description: str,
        customer_email: str | None = None,
    ) -> YookassaPaymentResult:
        body = {
            "amount": {
                "value": f"{amount:.2f}",
                "currency": "RUB",
            },
            "capture": True,
            "confirmation": {
                "type": "redirect",
                "return_url": self.runtime.return_url,
            },
            "description": description,
            "metadata": {
                "booking_id": str(booking_id),
            },
        }
        if customer_email:
            body["receipt"] = {
                "customer": {
                    "email": customer_email,
                },
                "items": [
                    {
                        "description": description,
                        "quantity": "1.00",
                        "amount": {
                            "value": f"{amount:.2f}",
                            "currency": "RUB",
                        },
                        "vat_code": self.runtime.vat_code,
                        "payment_mode": self.runtime.receipt_payment_mode,
                        "payment_subject": self.runtime.receipt_payment_subject,
                    }
                ],
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


def verify_legacy_signature(raw_body: bytes, signature: str | None, secret: str | None) -> bool:
    """Совместимость со старой подписью X-Payment-Sha1-Hash."""
    if not secret:
        return True
    if not signature:
        return False

    expected = hmac.new(
        key=secret.encode("utf-8"),
        msg=raw_body,
        digestmod=hashlib.sha1,
    ).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


def safe_json_loads(raw_body: bytes) -> dict:
    try:
        return json.loads(raw_body.decode("utf-8"))
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=400, detail="Некорректные данные платежного уведомления.") from exc
