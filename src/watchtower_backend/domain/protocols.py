"""Service protocols used to decouple providers from runtime logic."""

from __future__ import annotations

from typing import Protocol

from watchtower_backend.domain.commands import UnitCommand
from watchtower_backend.domain.events import RadioMessage
from watchtower_backend.domain.models.simulation import SessionState, WindState


class WeatherProvider(Protocol):
    """Contract for retrieving weather data."""

    async def get_wind(self) -> WindState:
        """Fetch wind state for a new session."""


class Planner(Protocol):
    """Contract for producing unit commands from session state."""

    async def plan(self, session_state: SessionState) -> list[UnitCommand]:
        """Return unit commands for the provided session state."""


class RadioSink(Protocol):
    """Contract for broadcasting radio transcript messages."""

    async def publish(self, session_state: SessionState, message: RadioMessage) -> None:
        """Publish a radio message."""
