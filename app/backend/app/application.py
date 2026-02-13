from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import Base, engine
from .routers.admin import router as admin_router
from .routers.payments import router as payments_router
from .routers.public import router as public_router


def _resolve_media_root(raw_path: str) -> Path | None:
    candidate = Path(raw_path)
    if candidate.is_absolute():
        return candidate if candidate.exists() else None

    here = Path(__file__).resolve()
    search_roots = [
        here.parent,          # app/backend/app
        here.parent.parent,   # app/backend
        here.parent.parent.parent,  # app
        here.parent.parent.parent.parent,  # project root
    ]
    for root in search_roots:
        resolved = (root / candidate).resolve()
        if resolved.exists():
            return resolved
    return None


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

    media_root = _resolve_media_root(settings.media_root)
    if media_root:
        app.mount("/media", StaticFiles(directory=str(media_root)), name="media")

    frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if frontend_dist.exists():
        app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="frontend-assets")

        @app.get("/", include_in_schema=False)
        def frontend_index() -> FileResponse:
            return FileResponse(str(frontend_dist / "index.html"))
    else:
        @app.get("/", include_in_schema=False)
        def root_stub() -> JSONResponse:
            return JSONResponse(
                {
                    "ok": True,
                    "message": "Backend is running. Frontend build not found.",
                    "next": "Build frontend to app/frontend/dist and redeploy.",
                }
            )

    app.include_router(public_router)
    app.include_router(payments_router)
    app.include_router(admin_router)

    # Local DB bootstrap (SQLite or any DB URL): create tables if missing.
    Base.metadata.create_all(bind=engine)
    return app


app = create_app()
