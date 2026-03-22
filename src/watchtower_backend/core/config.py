"""Application configuration for the WATCHTOWER backend.

This module provides:
- `Settings`: environment-backed application settings.
- `get_settings()`: cached settings accessor.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the backend services.

    Attributes:
        app_name: Human-readable application name.
        api_prefix: Prefix applied to all API routes.
        debug: Enables debug-friendly behavior.
        database_url: SQLAlchemy database URL.
        replay_directory: Directory used for replay event logs.
        audio_directory: Directory used for generated radio clips.
        default_grid_size: Default square simulation grid size.
        default_tick_interval_seconds: Simulation tick interval.
        default_planner_interval_seconds: Planner execution interval.
        max_session_event_backlog: Queue size for per-session subscribers.
    """

    model_config = SettingsConfigDict(
        env_prefix="WATCHTOWER_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="WATCHTOWER Backend")
    api_prefix: str = Field(default="/api/v1")
    debug: bool = Field(default=False)
    database_url: str = Field(default="sqlite+aiosqlite:///./watchtower.db")
    replay_directory: Path = Field(default=Path("data/replays"))
    audio_directory: Path = Field(default=Path("data/audio"))
    default_grid_size: int = Field(default=64, ge=16, le=128)
    default_tick_interval_seconds: float = Field(default=1.0, gt=0.0, le=10.0)
    default_planner_interval_seconds: float = Field(default=99999.0, gt=0.0, le=99999.0)
    max_session_event_backlog: int = Field(default=200, ge=10, le=5000)
    planner_model: str = Field(default="claude-3-5-haiku-latest")
    planner_timeout_seconds: float = Field(default=12.0, gt=0.0, le=60.0)
    planner_max_tokens: int = Field(default=800, ge=100, le=4000)
    planner_orchestrator_model: str = Field(default="claude-3-5-sonnet-20241022")
    planner_subagent_model: str = Field(default="claude-3-5-haiku-20241022")
    planner_orchestrator_max_tokens: int | None = Field(default=None)
    planner_subagent_max_tokens: int | None = Field(default=None)
    planner_graph_invoke_timeout_seconds: float = Field(default=120.0, gt=0.0, le=600.0)
    anthropic_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "WATCHTOWER_ANTHROPIC_API_KEY",
            "ANTHROPIC_API_KEY",
        ),
    )
    openweather_api_key: str | None = Field(default=None)
    openweather_latitude: float | None = Field(default=None, ge=-90.0, le=90.0)
    openweather_longitude: float | None = Field(default=None, ge=-180.0, le=180.0)
    weather_timeout_seconds: float = Field(default=8.0, gt=0.0, le=30.0)
    weather_fallback_direction: str = Field(default="NE", min_length=1, max_length=4)
    weather_fallback_speed_mph: float = Field(default=12.0, ge=0.0, le=100.0)
    radio_queue_size: int = Field(default=500, ge=10, le=5000)
    elevenlabs_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "WATCHTOWER_ELEVENLABS_API_KEY",
            "ELEVENLABS_API_KEY",
        ),
    )
    elevenlabs_model_id: str = Field(default="eleven_multilingual_v2")
    elevenlabs_output_format: str = Field(default="mp3_44100_128")
    # Pre-made ElevenLabs voices — override via env vars if desired.
    # pNInz6obpgDQGcFmaJgB = Adam  (deep, authoritative — command)
    # TxGEqnHWrfWFTfGW9XjX = Josh  (clear, operational — helicopter)
    # yoZ06aMxZJJ28mfd3POQ = Sam   (raspy, gritty — ground crew)
    elevenlabs_command_voice_id: str = Field(default="pNInz6obpgDQGcFmaJgB")
    elevenlabs_helicopter_voice_id: str = Field(default="TxGEqnHWrfWFTfGW9XjX")
    elevenlabs_ground_voice_id: str = Field(default="yoZ06aMxZJJ28mfd3POQ")
    luffa_robot_key: str | None = Field(default=None)
    luffa_group_uid: str | None = Field(default=None)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings.

    Returns:
        The process-wide settings instance.
    """
    return Settings()
