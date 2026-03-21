"""Integration provider tests."""

from __future__ import annotations

import httpx

from watchtower_backend.core.config import Settings
from watchtower_backend.services.integrations.weather import OpenWeatherProvider


async def test_openweather_provider_maps_live_response() -> None:
    """OpenWeather responses should be normalized into `WindState`.

    Returns:
        None.
    """

    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.params["units"] == "imperial"
        return httpx.Response(
            status_code=200,
            json={"wind": {"speed": 18.5, "deg": 90}},
        )

    settings = Settings(
        openweather_api_key="test-key",
        openweather_latitude=51.5,
        openweather_longitude=-0.1,
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        provider = OpenWeatherProvider(settings=settings, http_client=client)
        wind = await provider.get_wind()

    assert wind.direction == "E"
    assert wind.speed_mph == 18.5


async def test_openweather_provider_falls_back_on_error() -> None:
    """Provider should return fallback wind when the API fails.

    Returns:
        None.
    """

    async def handler(request: httpx.Request) -> httpx.Response:
        _ = request
        return httpx.Response(status_code=500, json={"message": "boom"})

    settings = Settings(
        openweather_api_key="test-key",
        openweather_latitude=51.5,
        openweather_longitude=-0.1,
        weather_fallback_direction="SW",
        weather_fallback_speed_mph=7.0,
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        provider = OpenWeatherProvider(settings=settings, http_client=client)
        wind = await provider.get_wind()

    assert wind.direction == "SW"
    assert wind.speed_mph == 7.0
