from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Atman API")
    app_env: str = os.getenv("APP_ENV", "development")
    app_debug: bool = os.getenv("APP_DEBUG", "1") in {"1", "true", "True"}
    cors_origins: str = os.getenv("CORS_ORIGINS", "*")

    database_url: str = os.getenv("DATABASE_URL", f"sqlite:///{(BASE_DIR / 'data' / 'site.db').as_posix()}")

    media_root: str = os.getenv("MEDIA_ROOT", "../../Сайт Атман")

    yookassa_shop_id: str | None = os.getenv("YOOKASSA_SHOP_ID")
    yookassa_secret_key: str | None = os.getenv("YOOKASSA_SECRET_KEY")
    yookassa_return_url: str = os.getenv("YOOKASSA_RETURN_URL", "http://localhost:5173/")
    yookassa_webhook_secret: str | None = os.getenv("YOOKASSA_WEBHOOK_SECRET")

    admin_token: str | None = os.getenv("ADMIN_TOKEN")

    @property
    def cors_origins_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def yookassa_enabled(self) -> bool:
        return bool(self.yookassa_shop_id and self.yookassa_secret_key)


settings = Settings()
