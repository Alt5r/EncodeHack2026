"""Database setup for async SQLAlchemy usage."""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from watchtower_backend.core.config import Settings


class Base(DeclarativeBase):
    """Base class for ORM models."""


def create_engine(settings: Settings) -> AsyncEngine:
    """Create the application database engine.

    Args:
        settings: Application settings.

    Returns:
        The configured async SQLAlchemy engine.
    """
    return create_async_engine(settings.database_url, future=True)


def create_session_factory(settings: Settings) -> async_sessionmaker[AsyncSession]:
    """Create the async session factory.

    Args:
        settings: Application settings.

    Returns:
        Session factory bound to the configured engine.
    """
    engine = create_engine(settings)
    return async_sessionmaker(engine, expire_on_commit=False)


async def session_dependency(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[AsyncSession]:
    """Yield a database session for FastAPI dependencies.

    Args:
        session_factory: Session factory to use.

    Yields:
        An async SQLAlchemy session.
    """
    async with session_factory() as session:
        yield session
