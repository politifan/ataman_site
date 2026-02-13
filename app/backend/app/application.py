from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import settings
from .routers.admin import router as admin_router
from .routers.payments import router as payments_router
from .routers.public import router as public_router


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.2.0",
        description="Перенос сайта Атман: FastAPI + MySQL + ЮKassa + admin API.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    media_root = (Path(__file__).resolve().parent / settings.media_root).resolve()
    if media_root.exists():
        app.mount("/media", StaticFiles(directory=str(media_root)), name="media")

    app.include_router(public_router)
    app.include_router(payments_router)
    app.include_router(admin_router)
    return app


app = create_app()
