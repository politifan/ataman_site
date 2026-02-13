try:
    # Import path when module is loaded as package: app.backend.main
    from .app.application import app
except ImportError:
    # Import path when running from app/backend directory: uvicorn main:app
    from app.application import app

__all__ = ["app"]
