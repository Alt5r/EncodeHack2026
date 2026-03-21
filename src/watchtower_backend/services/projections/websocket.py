"""Per-session WebSocket subscription utilities."""

from __future__ import annotations

import asyncio
from contextlib import suppress

from watchtower_backend.domain.events import BroadcastEnvelope, SessionEvent


class SessionBroadcaster:
    """Fan out session events to multiple WebSocket subscribers."""

    def __init__(self, max_backlog: int) -> None:
        """Initialize the broadcaster.

        Args:
            max_backlog: Maximum queue size per subscriber.
        """
        self._max_backlog = max_backlog
        self._subscribers: set[asyncio.Queue[BroadcastEnvelope]] = set()

    async def publish_event(self, event: SessionEvent) -> None:
        """Publish an event to all subscribers."""
        await self._publish(envelope=BroadcastEnvelope(kind="event", event=event))

    async def publish_snapshot(self, snapshot: dict[str, object]) -> None:
        """Publish a state snapshot to all subscribers."""
        await self._publish(envelope=BroadcastEnvelope(kind="snapshot", snapshot=snapshot))

    async def _publish(self, envelope: BroadcastEnvelope) -> None:
        stale_subscribers: list[asyncio.Queue[BroadcastEnvelope]] = []
        for subscriber in self._subscribers:
            try:
                subscriber.put_nowait(envelope)
            except asyncio.QueueFull:
                stale_subscribers.append(subscriber)
        for subscriber in stale_subscribers:
            self._subscribers.discard(subscriber)

    async def subscribe(self) -> asyncio.Queue[BroadcastEnvelope]:
        """Register a new subscriber queue."""
        queue: asyncio.Queue[BroadcastEnvelope] = asyncio.Queue(maxsize=self._max_backlog)
        self._subscribers.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue[BroadcastEnvelope]) -> None:
        """Unregister a subscriber queue."""
        with suppress(KeyError):
            self._subscribers.remove(queue)
