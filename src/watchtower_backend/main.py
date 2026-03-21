"""FastAPI application factory for WATCHTOWER."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from watchtower_backend.api.routers.health import router as health_router
from watchtower_backend.api.routers.leaderboard import router as leaderboard_router
from watchtower_backend.api.routers.replays import router as replays_router
from watchtower_backend.api.routers.sessions import router as sessions_router
from watchtower_backend.core.config import get_settings
from watchtower_backend.core.errors import SessionNotFoundError
from watchtower_backend.core.lifespan import lifespan
from watchtower_backend.core.logging import configure_logging


def create_app() -> FastAPI:
    """Create the FastAPI application.

    Returns:
        Configured FastAPI application.
    """
    settings = get_settings()
    configure_logging()

    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
    )
    settings.audio_directory.mkdir(parents=True, exist_ok=True)
    app.mount("/media/audio", StaticFiles(directory=settings.audio_directory), name="audio")
    app.include_router(health_router, prefix=settings.api_prefix)
    app.include_router(sessions_router, prefix=settings.api_prefix)
    app.include_router(leaderboard_router, prefix=settings.api_prefix)
    app.include_router(replays_router, prefix=settings.api_prefix)

    @app.exception_handler(SessionNotFoundError)
    async def handle_session_not_found(
        request: Request,
        error: SessionNotFoundError,
    ) -> JSONResponse:
        """Translate missing session errors into HTTP 404 responses."""
        _ = request
        return JSONResponse(status_code=404, content={"detail": str(error)})

    @app.exception_handler(HTTPException)
    async def handle_http_exception(request: Request, error: HTTPException) -> JSONResponse:
        """Translate HTTP exceptions into JSON responses."""
        _ = request
        return JSONResponse(status_code=error.status_code, content={"detail": error.detail})

    return app


app = create_app()
