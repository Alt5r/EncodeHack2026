"""Radio transcript service."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from contextlib import suppress

from elevenlabs.client import AsyncElevenLabs

from watchtower_backend.core.config import Settings
from watchtower_backend.domain.events import RadioMessage
from watchtower_backend.domain.models.simulation import SessionState

logger = logging.getLogger(__name__)

type RadioEventPublisher = Callable[[str, str, dict[str, object]], Awaitable[None]]
type LuffaRadioRelay = Callable[[RadioMessage], Awaitable[None]]


class InMemoryRadioService:
    """Collect radio messages for broadcast without external TTS dependencies."""

    async def publish(self, session_state: SessionState, message: RadioMessage) -> None:
        """Accept a radio message.

        Args:
            session_state: Source session state.
            message: Radio message to publish.

        Returns:
            None.
        """
        _ = (session_state, message)


class CompositeRadioService:
    """Queue radio side effects so the simulation loop stays non-blocking."""

    def __init__(
        self,
        settings: Settings,
        event_publisher: RadioEventPublisher | None,
        elevenlabs_client: AsyncElevenLabs | None = None,
    ) -> None:
        """Initialize the radio service.

        Args:
            settings: Application settings.
            event_publisher: Callback for emitting follow-up session events.
            elevenlabs_client: Optional ElevenLabs async client.
        """
        self._settings = settings
        self._event_publisher = event_publisher
        self._elevenlabs_client = elevenlabs_client
        self._queue: asyncio.Queue[tuple[str, RadioMessage]] = asyncio.Queue(
            maxsize=settings.radio_queue_size
        )
        self._worker_task: asyncio.Task[None] | None = None
        self._audio_directory = settings.audio_directory
        self._audio_directory.mkdir(parents=True, exist_ok=True)
        self._luffa_relay: LuffaRadioRelay | None = None

    async def start(self) -> None:
        """Start the background worker."""
        if self._worker_task is None:
            self._worker_task = asyncio.create_task(self._worker(), name="radio-worker")

    async def close(self) -> None:
        """Stop the background worker."""
        if self._worker_task is not None:
            self._worker_task.cancel()
            with suppress(asyncio.CancelledError):
                await self._worker_task

    def bind_luffa_relay(self, relay: LuffaRadioRelay | None) -> None:
        """Attach or clear the optional Luffa radio relay callback.

        Args:
            relay: Async function to deliver formatted radio lines to Luffa, or None.

        Returns:
            None.
        """
        self._luffa_relay = relay

    async def publish(self, session_state: SessionState, message: RadioMessage) -> None:
        """Queue radio side effects for background processing.

        Args:
            session_state: Source session state.
            message: Radio message to publish.

        Returns:
            None.
        """
        try:
            self._queue.put_nowait((session_state.id, message))
        except asyncio.QueueFull:
            logger.warning(
                "Radio queue full; dropping message.",
                extra={"session_id": session_state.id, "message_id": message.message_id},
            )

    async def _worker(self) -> None:
        """Process queued radio side effects."""
        while True:
            session_id, message = await self._queue.get()
            try:
                await self._process_message(session_id=session_id, message=message)
            except Exception as error:
                logger.warning(
                    "Radio processing failed.",
                    extra={
                        "session_id": session_id,
                        "message_id": message.message_id,
                        "error": str(error),
                    },
                )

    async def _process_message(self, session_id: str, message: RadioMessage) -> None:
        """Handle TTS and relay work for one message."""
        audio_url = await self._maybe_synthesize_audio(session_id=session_id, message=message)
        if audio_url is not None and self._event_publisher is not None:
            await self._event_publisher(
                session_id,
                "radio.audio_ready",
                {
                    "message_id": message.message_id,
                    "speaker": message.speaker,
                    "audio_url": audio_url,
                },
            )
        await self._maybe_send_to_luffa(message=message)

    async def _maybe_synthesize_audio(self, session_id: str, message: RadioMessage) -> str | None:
        """Generate an audio clip when ElevenLabs is configured."""
        if self._elevenlabs_client is None:
            return None

        voice_id = self._resolve_voice_id(message.voice_key)
        if voice_id is None:
            return None

        session_directory = self._audio_directory / session_id
        session_directory.mkdir(parents=True, exist_ok=True)
        file_path = session_directory / f"{message.message_id}.mp3"
        audio_chunks = self._elevenlabs_client.text_to_speech.convert(
            voice_id=voice_id,
            text=message.text,
            model_id=self._settings.elevenlabs_model_id,
            output_format=self._settings.elevenlabs_output_format,
        )
        audio_bytes = b""
        async for chunk in audio_chunks:
            audio_bytes += chunk

        with file_path.open("wb") as audio_file:
            audio_file.write(audio_bytes)

        return f"/media/audio/{session_id}/{message.message_id}.mp3"

    async def _maybe_send_to_luffa(self, message: RadioMessage) -> None:
        """Relay the radio message to Luffa when a relay callback is bound."""
        if self._luffa_relay is None:
            return
        await self._luffa_relay(message)

    def _resolve_voice_id(self, voice_key: str) -> str | None:
        """Resolve a logical voice key to an ElevenLabs voice id."""
        if voice_key == "command":
            return self._settings.elevenlabs_command_voice_id
        if voice_key == "helicopter":
            return self._settings.elevenlabs_helicopter_voice_id
        if voice_key == "ground":
            return self._settings.elevenlabs_ground_voice_id
        return None
