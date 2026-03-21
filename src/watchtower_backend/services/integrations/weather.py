"""Weather provider integrations."""

from __future__ import annotations

import logging

import httpx

from watchtower_backend.core.config import Settings
from watchtower_backend.domain.models.simulation import WindState

logger = logging.getLogger(__name__)


class StaticWeatherProvider:
    """Return deterministic wind conditions for local development."""

    async def get_wind(self) -> WindState:
        """Return a fixed wind state.

        Returns:
            Deterministic wind conditions.
        """
        return WindState(direction="NE", speed_mph=12.0)


class OpenWeatherProvider:
    """Fetch live wind data from OpenWeather with deterministic fallback."""

    def __init__(self, settings: Settings, http_client: httpx.AsyncClient) -> None:
        """Initialize the provider.

        Args:
            settings: Application settings.
            http_client: Shared HTTP client.
        """
        self._settings = settings
        self._http_client = http_client

    async def get_wind(self) -> WindState:
        """Return live or fallback wind data.

        Returns:
            Wind state for a new session.
        """
        if (
            not self._settings.openweather_api_key
            or self._settings.openweather_latitude is None
            or self._settings.openweather_longitude is None
        ):
            return self._fallback_wind()

        try:
            response = await self._http_client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={
                    "appid": self._settings.openweather_api_key,
                    "lat": self._settings.openweather_latitude,
                    "lon": self._settings.openweather_longitude,
                    "units": "imperial",
                },
                timeout=self._settings.weather_timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
            wind_payload = payload.get("wind", {})
            speed_mph = float(wind_payload.get("speed", self._settings.weather_fallback_speed_mph))
            direction = _degrees_to_direction(degrees=float(wind_payload.get("deg", 45.0)))
            return WindState(direction=direction, speed_mph=speed_mph)
        except Exception as error:
            logger.warning(
                "OpenWeather lookup failed; using fallback wind.", extra={"error": str(error)}
            )
            return self._fallback_wind()

    def _fallback_wind(self) -> WindState:
        """Build the configured fallback wind state."""
        return WindState(
            direction=self._settings.weather_fallback_direction,
            speed_mph=self._settings.weather_fallback_speed_mph,
        )


def _degrees_to_direction(degrees: float) -> str:
    """Convert wind degrees to a coarse cardinal direction.

    Args:
        degrees: Wind direction in degrees.

    Returns:
        Cardinal direction code.
    """
    normalized = degrees % 360.0
    directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    index = int((normalized + 22.5) // 45) % len(directions)
    return directions[index]
