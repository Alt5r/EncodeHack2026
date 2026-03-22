"""Tests for backend radio event emission."""

from __future__ import annotations

import asyncio

from watchtower_backend.core.config import Settings
from watchtower_backend.domain.events import RadioMessage
from watchtower_backend.domain.models.simulation import WindState
from watchtower_backend.services.radio.service import CompositeRadioService
from watchtower_backend.services.sessions.runtime import build_initial_state


async def test_composite_radio_service_emits_radio_message_event(tmp_path) -> None:
    """Published radio lines should always emit a transcript event, even before audio is ready."""
    published_events: list[tuple[str, str, dict[str, object]]] = []

    async def event_publisher(
        session_id: str,
        event_type: str,
        payload: dict[str, object],
    ) -> None:
        published_events.append((session_id, event_type, payload))

    settings = Settings(
        audio_directory=tmp_path / "audio",
    )
    service = CompositeRadioService(
        settings=settings,
        event_publisher=event_publisher,
        elevenlabs_client=None,
    )
    session_state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    session_state.tick = 7
    message = RadioMessage(
        speaker="Alpha",
        voice_key="helicopter",
        text="Inbound to the flank.",
    )

    await service.start()
    await service.publish(session_state=session_state, message=message)
    await asyncio.sleep(0.05)
    await service.close()

    assert published_events
    assert published_events[0][0] == session_state.id
    assert published_events[0][1] == "radio.message"
    assert published_events[0][2]["message_id"] == message.message_id
    assert published_events[0][2]["speaker"] == "Alpha"
    assert published_events[0][2]["voice_key"] == "helicopter"
    assert published_events[0][2]["text"] == "Inbound to the flank."
    assert published_events[0][2]["tick"] == 7


async def test_composite_radio_service_drops_queued_audio_for_closed_session(tmp_path) -> None:
    """Closed sessions should stop emitting queued radio lines."""
    published_events: list[tuple[str, str, dict[str, object]]] = []

    async def event_publisher(
        session_id: str,
        event_type: str,
        payload: dict[str, object],
    ) -> None:
        published_events.append((session_id, event_type, payload))

    settings = Settings(
        audio_directory=tmp_path / "audio",
    )
    service = CompositeRadioService(
        settings=settings,
        event_publisher=event_publisher,
        elevenlabs_client=None,
    )
    session_state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    message = RadioMessage(
        speaker="Alpha",
        voice_key="helicopter",
        text="Inbound to the flank.",
    )

    await service.start()
    await service.publish(session_state=session_state, message=message)
    await service.close_session(session_state.id)
    await asyncio.sleep(0.05)
    await service.close()

    assert published_events == []
