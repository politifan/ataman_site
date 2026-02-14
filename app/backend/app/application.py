from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from .config import settings
from .db import Base, SessionLocal, engine
from .models import Service
from .routers.admin import router as admin_router
from .routers.auth import router as auth_router
from .routers.payments import router as payments_router
from .routers.public import router as public_router
from .security import ensure_bootstrap_admin


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
    frontend_enabled = frontend_dist.exists()
    if frontend_enabled:
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
    app.include_router(auth_router)
    app.include_router(admin_router)

    @app.get("/robots.txt", include_in_schema=False)
    def robots_txt() -> Response:
        base = settings.site_url.rstrip("/")
        body = "\n".join(
            [
                "User-agent: *",
                "Allow: /",
                "Disallow: /admin/",
                "Disallow: /api/admin/",
                "Disallow: /.env",
                "Disallow: /__pycache__/",
                f"Sitemap: {base}/sitemap.xml",
                "",
            ]
        )
        return Response(content=body, media_type="text/plain; charset=utf-8")

    @app.get("/sitemap.xml", include_in_schema=False)
    def sitemap_xml() -> Response:
        base = settings.site_url.rstrip("/")
        now = datetime.now(timezone.utc).date().isoformat()
        static_urls = [
            "/",
            "/services",
            "/schedule",
            "/gallery",
            "/contacts",
            "/legal/privacy",
            "/legal/personal-data",
            "/legal/terms",
            "/legal/offer",
            "/legal/marketing",
        ]

        db = SessionLocal()
        try:
            service_urls = [
                f"/services/{slug}"
                for slug in db.scalars(
                    select(Service.slug).where(Service.is_active.is_(True), Service.is_draft.is_(False))
                ).all()
            ]
        finally:
            db.close()

        all_urls = static_urls + service_urls
        url_nodes = "\n".join(
            [
                f"  <url><loc>{base}{path}</loc><lastmod>{now}</lastmod></url>"
                for path in all_urls
            ]
        )
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{url_nodes}\n"
            "</urlset>\n"
        )
        return Response(content=xml, media_type="application/xml; charset=utf-8")

    @app.get("/check_payment_status.php", include_in_schema=False, response_model=None)
    def legacy_check_payment_status(payment_id: str = Query(default="")) -> Response:
        if not payment_id:
            return JSONResponse({"error": "Payment ID is required"}, status_code=400)
        return RedirectResponse(url=f"/api/payments/{payment_id}/status", status_code=307)

    if frontend_enabled:
        @app.get("/{full_path:path}", include_in_schema=False)
        def frontend_spa_fallback(full_path: str) -> FileResponse | JSONResponse:
            if full_path.startswith(("api/", "media/", "assets/", "robots.txt", "sitemap.xml")):
                return JSONResponse({"detail": "Not Found"}, status_code=404)
            return FileResponse(str(frontend_dist / "index.html"))

    # Local DB bootstrap (SQLite or any DB URL): create tables if missing.
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_bootstrap_admin(db)
    finally:
        db.close()
    return app


app = create_app()
