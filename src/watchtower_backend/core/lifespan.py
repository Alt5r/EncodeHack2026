"""Application lifespan wiring."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from anthropic import AsyncAnthropic
from elevenlabs.client import AsyncElevenLabs
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker

from watchtower_backend.core.config import get_settings
from watchtower_backend.persistence.db import Base, create_engine, create_session_factory
from watchtower_backend.services.integrations.weather import OpenWeatherProvider
from watchtower_backend.services.planning.orchestrator import AnthropicPlanner, HeuristicPlanner
from watchtower_backend.services.radio.service import CompositeRadioService
from watchtower_backend.services.sessions.manager import SessionManager


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize and clean up app-scoped services.

    Args:
        app: FastAPI application instance.

    Yields:
        None.
    """
    settings = get_settings()
    http_client = httpx.AsyncClient()
    engine = create_engine(settings=settings)
    session_factory: async_sessionmaker = create_session_factory(settings=settings)
    fallback_planner = HeuristicPlanner()
    anthropic_client = (
        AsyncAnthropic(api_key=settings.anthropic_api_key) if settings.anthropic_api_key else None
    )
    elevenlabs_client = (
        AsyncElevenLabs(api_key=settings.elevenlabs_api_key)
        if settings.elevenlabs_api_key
        else None
    )

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async def publish_session_event(
        session_id: str,
        event_type: str,
        payload: dict[str, object],
    ) -> None:
        await app.state.session_manager.publish_external_event(
            session_id=session_id,
            event_type=event_type,
            payload=payload,
        )

    radio_service = CompositeRadioService(
        settings=settings,
        event_publisher=publish_session_event,
        elevenlabs_client=elevenlabs_client,
    )

    app.state.settings = settings
    app.state.engine = engine
    app.state.http_client = http_client
    app.state.session_factory = session_factory
    app.state.session_manager = SessionManager(
        settings=settings,
        session_factory=session_factory,
        weather_provider=OpenWeatherProvider(
            settings=settings,
            http_client=http_client,
        ),
        planner=AnthropicPlanner(
            model=settings.planner_model,
            timeout_seconds=settings.planner_timeout_seconds,
            max_tokens=settings.planner_max_tokens,
            fallback_planner=fallback_planner,
            anthropic_client=anthropic_client,
        ),
        radio_sink=radio_service,
    )
    await radio_service.start()
    yield
    await radio_service.close()
    await app.state.session_manager.close()
    await http_client.aclose()
    await engine.dispose()
