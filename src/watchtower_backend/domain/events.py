"""Typed domain events emitted by active sessions."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class SessionEvent(BaseModel):
    """Base event sent to clients and replay storage."""

    type: str
    session_id: str
    tick: int = Field(ge=0)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(tz=UTC))
    payload: dict[str, object] = Field(default_factory=dict)


class RadioMessage(BaseModel):
    """A transcript and voice-ready radio message."""

    message_id: str = Field(default_factory=lambda: uuid4().hex)
    speaker: str = Field(min_length=1, max_length=50)
    voice_key: str = Field(default="command", min_length=1, max_length=50)
    text: str = Field(min_length=1, max_length=500)
    created_at: datetime = Field(default_factory=lambda: datetime.now(tz=UTC))


class BroadcastEnvelope(BaseModel):
    """WebSocket-friendly event envelope."""

    kind: Literal["event", "snapshot"] = "event"
    event: SessionEvent | None = None
    snapshot: dict[str, object] | None = None
