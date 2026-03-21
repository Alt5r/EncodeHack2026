"""Replay event storage for sessions."""

from __future__ import annotations

from pathlib import Path

import orjson

from watchtower_backend.domain.events import SessionEvent


class ReplayStore:
    """Persist session events to JSONL files."""

    def __init__(self, root_directory: Path) -> None:
        """Initialize the replay store.

        Args:
            root_directory: Directory used for replay files.
        """
        self._root_directory = root_directory
        self._root_directory.mkdir(parents=True, exist_ok=True)

    def get_replay_path(self, session_id: str) -> Path:
        """Return the replay file path for a session.

        Args:
            session_id: Session identifier.

        Returns:
            Replay file path.
        """
        return self._root_directory / f"{session_id}.jsonl"

    async def append(self, event: SessionEvent) -> None:
        """Append an event to the replay log.

        Args:
            event: Event to persist.

        Returns:
            None.
        """
        path = self.get_replay_path(event.session_id)
        with path.open("ab") as replay_file:
            replay_file.write(orjson.dumps(event.model_dump(mode="json")) + b"\n")
