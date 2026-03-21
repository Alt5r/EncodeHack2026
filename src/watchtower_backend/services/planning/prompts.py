"""Prompt builders for WATCHTOWER planning."""

from __future__ import annotations

from watchtower_backend.domain.models.simulation import SessionState, UnitType


def build_planner_prompt(session_state: SessionState) -> str:
    """Build the planner prompt from current session state.

    Args:
        session_state: Current session state snapshot.

    Returns:
        Prompt text instructing the model to emit JSON commands.
    """
    active_units = [
        {
            "unit_id": unit.id,
            "label": unit.label,
            "unit_type": unit.unit_type.value,
            "position": unit.position,
            "water_remaining": unit.water_remaining,
            "firebreak_strength": unit.firebreak_strength,
            "status_text": unit.status_text,
        }
        for unit in session_state.units
        if unit.unit_type is not UnitType.ORCHESTRATOR
    ]
    summary = {
        "session_id": session_state.id,
        "tick": session_state.tick,
        "grid_size": session_state.grid_size,
        "doctrine_title": session_state.doctrine.title,
        "doctrine_text": session_state.doctrine.text,
        "wind": session_state.wind.model_dump(mode="json"),
        "village": session_state.village.model_dump(mode="json"),
        "fire_cells": session_state.fire_cells[:24],
        "firebreak_cells": session_state.firebreak_cells[:24],
        "units": active_units,
    }
    return (
        "You are the WATCHTOWER wildfire command planner.\n"
        "Return only valid JSON with shape:\n"
        '{ "commands": ['
        '{"unit_id": "heli-alpha", "action": "drop_water", "target_x": 4, '
        '"target_y": 12, "rationale": "short explanation"} ] }\n'
        "Rules:\n"
        "- Only command listed units.\n"
        "- Allowed actions: move, drop_water, create_firebreak, hold_position.\n"
        "- Helicopters should prefer drop_water or move.\n"
        "- Ground crews should prefer create_firebreak or move.\n"
        "- Protect the village first.\n"
        "- Keep rationale short and concrete.\n"
        "- Return JSON only, no markdown.\n\n"
        f"Current state:\n{summary!r}\n"
    )
