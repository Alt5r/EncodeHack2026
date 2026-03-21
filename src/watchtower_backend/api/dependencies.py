"""FastAPI dependency helpers."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from watchtower_backend.services.sessions.manager import SessionManager


def get_session_manager(request: Request) -> SessionManager:
    """Return the shared session manager from app state."""
    return request.app.state.session_manager


def get_session_factory(request: Request) -> async_sessionmaker[AsyncSession]:
    """Return the shared session factory from app state."""
    return request.app.state.session_factory


SessionManagerDependency = Annotated[SessionManager, Depends(get_session_manager)]
