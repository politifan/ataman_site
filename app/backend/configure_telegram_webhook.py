from __future__ import annotations

import argparse
import sys

from app.db import SessionLocal
from app.services.runtime_settings import resolve_telegram_notification_settings
from app.services.telegram_webhook import get_telegram_webhook_info, register_telegram_webhook


def _print_info(info: dict, *, proxy_enabled: bool) -> None:
    print("Telegram webhook status")
    print("url =", info.get("url") or "<not configured>")
    print("proxy =", "configured" if proxy_enabled else "not configured")
    print("pending_update_count =", info.get("pending_update_count", 0))
    print("last_error_date =", info.get("last_error_date") or "<none>")
    print("last_error_message =", info.get("last_error_message") or "<none>")


def main() -> None:
    parser = argparse.ArgumentParser(description="Configure or inspect the Telegram callback webhook.")
    parser.add_argument("--status-only", action="store_true", help="Only request getWebhookInfo without changing webhook.")
    parser.add_argument("--url", help="Override webhook URL. Defaults to SITE_URL/api/telegram/webhook.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        runtime = resolve_telegram_notification_settings(db)
        try:
            if args.status_only:
                info = get_telegram_webhook_info(db)
            else:
                info = register_telegram_webhook(db, args.url)
        except Exception as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            raise SystemExit(1) from exc
        _print_info(info, proxy_enabled=bool(runtime.proxy_url))
    finally:
        db.close()


if __name__ == "__main__":
    main()
