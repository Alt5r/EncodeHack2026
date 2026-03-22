"""API integration tests."""

from __future__ import annotations

from fastapi.testclient import TestClient

from watchtower_backend.core.config import get_settings
from watchtower_backend.main import create_app


def test_session_lifecycle_and_leaderboard(monkeypatch, tmp_path) -> None:
    """The API should create, terminate, and persist a session.

    Args:
        monkeypatch: Pytest monkeypatch fixture.
        tmp_path: Temporary directory for isolated persistence.

    Returns:
        None.
    """
    monkeypatch.setenv("WATCHTOWER_DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("WATCHTOWER_REPLAY_DIRECTORY", str(tmp_path / "replays"))
    monkeypatch.setenv("WATCHTOWER_DEFAULT_TICK_INTERVAL_SECONDS", "0.01")
    monkeypatch.setenv("WATCHTOWER_DEFAULT_PLANNER_INTERVAL_SECONDS", "0.01")
    get_settings.cache_clear()

    with TestClient(create_app()) as client:
        create_response = client.post(
            "/api/v1/sessions",
            json={"doctrine_text": "Protect the village at all costs.", "doctrine_title": "Shield"},
        )
        assert create_response.status_code == 200
        assert create_response.json()["air_support_missions"] == []
        assert create_response.json()["treated_cells"] == []
        session_id = create_response.json()["id"]

        session_response = client.get(f"/api/v1/sessions/{session_id}")
        assert session_response.status_code == 200
        assert session_response.json()["doctrine_title"] == "Shield"

        terminate_response = client.post(f"/api/v1/sessions/{session_id}/terminate")
        assert terminate_response.status_code == 200
        assert terminate_response.json()["status"] in {"terminated", "won", "lost"}

        replay_response = client.get(f"/api/v1/replays/{session_id}")
        assert replay_response.status_code == 200
        assert len(replay_response.json()["events"]) >= 1

        leaderboard_response = client.get("/api/v1/leaderboard")
        assert leaderboard_response.status_code == 200
        assert len(leaderboard_response.json()) == 1

    get_settings.cache_clear()
