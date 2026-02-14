from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "Atman API")
    app_env: str = os.getenv("APP_ENV", "development")
    app_debug: bool = os.getenv("APP_DEBUG", "1") in {"1", "true", "True"}
    cors_origins: str = os.getenv("CORS_ORIGINS", "*")

    database_url: str = os.getenv("DATABASE_URL", f"sqlite:///{(BASE_DIR / 'data' / 'site.db').as_posix()}")

    media_root: str = os.getenv("MEDIA_ROOT", "../../media_assets")
    site_url: str = os.getenv("SITE_URL", "https://spiritualst.ru")

    yookassa_shop_id: str | None = os.getenv("YOOKASSA_SHOP_ID")
    yookassa_secret_key: str | None = os.getenv("YOOKASSA_SECRET_KEY")
    yookassa_return_url: str = os.getenv("YOOKASSA_RETURN_URL", "http://localhost:5173/")
    yookassa_webhook_secret: str | None = os.getenv("YOOKASSA_WEBHOOK_SECRET")

    admin_token: str | None = os.getenv("ADMIN_TOKEN")
    admin_jwt_secret: str = os.getenv("ADMIN_JWT_SECRET", os.getenv("ADMIN_TOKEN", "change_me_secret"))
    admin_access_ttl_minutes: int = int(os.getenv("ADMIN_ACCESS_TTL_MINUTES", "720"))
    admin_bootstrap_username: str = os.getenv("ADMIN_BOOTSTRAP_USERNAME", "admin")
    admin_bootstrap_password: str = os.getenv("ADMIN_BOOTSTRAP_PASSWORD", "change_me_now")
    admin_bootstrap_role: str = os.getenv("ADMIN_BOOTSTRAP_ROLE", "admin")

    @property
    def cors_origins_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def yookassa_enabled(self) -> bool:
        return bool(self.yookassa_shop_id and self.yookassa_secret_key)


settings = Settings()
