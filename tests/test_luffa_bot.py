"""Tests for Luffa integration helpers."""

from __future__ import annotations

from watchtower_backend.domain.events import RadioMessage
from watchtower_backend.domain.models.simulation import VillageState, WindState
from watchtower_backend.services.integrations.luffa import (
    fire_spread_near_village,
    format_agents_summary,
    format_fire_summary,
    format_radio_line,
    format_status_summary,
)
from watchtower_backend.services.sessions.runtime import build_initial_state


def test_format_radio_line_command() -> None:
    msg = RadioMessage(speaker="Command", voice_key="command", text="Hold positions.")
    assert "📡 COMMAND" in format_radio_line(msg)
    assert "Command" in format_radio_line(msg)


def test_format_radio_line_helicopter() -> None:
    msg = RadioMessage(speaker="Alpha", voice_key="helicopter", text="Dropping now.")
    line = format_radio_line(msg)
    assert "🚁" in line
    assert "Alpha" in line


def test_fire_spread_near_village_detects_close_cell() -> None:
    village = VillageState(top_left=(10, 10), size=4)
    cells = [(12, 12)]
    assert fire_spread_near_village(cells, village, threshold=4) is True


def test_fire_spread_near_village_ignores_far_cell() -> None:
    village = VillageState(top_left=(10, 10), size=4)
    cells = [(0, 0)]
    assert fire_spread_near_village(cells, village, threshold=2) is False


def test_format_status_and_fire_summaries() -> None:
    state = build_initial_state(
        doctrine_text="Test doctrine for summary.",
        doctrine_title="T1",
        wind=WindState(direction="N", speed_mph=5.0),
        grid_size=32,
    )
    s = format_status_summary(state)
    assert "tick=" in s
    assert "Wind" in s
    f = format_fire_summary(state)
    assert "Fire fronts" in f


def test_format_agents_skips_orchestrator() -> None:
    state = build_initial_state(
        doctrine_text="x",
        doctrine_title=None,
        wind=WindState(),
        grid_size=32,
    )
    a = format_agents_summary(state)
    assert "Watchtower" not in a
    assert "Alpha" in a or "heli" in a.lower()
