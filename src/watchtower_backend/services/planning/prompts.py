"""Prompt builders for WATCHTOWER planning."""

from __future__ import annotations

from watchtower_backend.domain.commands import Mission
from watchtower_backend.domain.models.simulation import SessionState, UnitType


def _active_units_summary(session_state: SessionState) -> list[dict[str, object]]:
    return [
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


def build_planner_prompt(session_state: SessionState) -> str:
    """Build the single-call planner prompt from current session state.

    Args:
        session_state: Current session state snapshot.

    Returns:
        Prompt text instructing the model to emit JSON commands.
    """
    active_units = _active_units_summary(session_state=session_state)
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


def build_orchestrator_prompt(session_state: SessionState) -> str:
    """Build the strategic orchestrator prompt (missions, not low-level moves).

    Args:
        session_state: Current session state snapshot.

    Returns:
        User message text for the orchestrator model.
    """
    active_units = _active_units_summary(session_state=session_state)
    summary = {
        "session_id": session_state.id,
        "tick": session_state.tick,
        "version": session_state.version,
        "grid_size": session_state.grid_size,
        "doctrine_title": session_state.doctrine.title,
        "doctrine_text": session_state.doctrine.text,
        "wind": session_state.wind.model_dump(mode="json"),
        "village": session_state.village.model_dump(mode="json"),
        "fire_cells": session_state.fire_cells[:48],
        "firebreak_cells": session_state.firebreak_cells[:24],
        "units": active_units,
    }
    return (
        "You are the WATCHTOWER incident orchestrator (command level).\n"
        "Return only valid JSON with shape:\n"
        '{ "missions": [\n'
        '  {"agent_id": "heli-alpha", "intent": "suppress", "target_x": 4, "target_y": 12, '
        '"priority": 10, "reason": "why this unit gets this mission"}\n'
        "] }\n"
        "Rules:\n"
        "- Emit one mission per field unit listed (exclude orchestrator/tower).\n"
        "- intent: short verb phrase: suppress | firebreak | reserve | reposition | support.\n"
        "- target_x/target_y: focus cell on the grid (0..grid_size-1).\n"
        "- priority: 0-1000; higher = more urgent when resolving conflicts.\n"
        "- Align missions with the player's doctrine and protect the village.\n"
        "- Return JSON only, no markdown.\n\n"
        f"Current state:\n{summary!r}\n"
    )


def build_subagent_prompt(session_state: SessionState, mission: Mission) -> str:
    """Build the tactical prompt for one unit's sub-agent.

    Args:
        session_state: Full session snapshot (authoritative context).
        mission: Mission assigned to this unit.

    Returns:
        User message text for the sub-agent model.
    """
    unit = next((u for u in session_state.units if u.id == mission.agent_id), None)
    unit_blob: dict[str, object] | None = None
    if unit is not None:
        unit_blob = {
            "unit_id": unit.id,
            "label": unit.label,
            "unit_type": unit.unit_type.value,
            "position": unit.position,
            "water_remaining": unit.water_remaining,
            "water_capacity": unit.water_capacity,
            "firebreak_strength": unit.firebreak_strength,
            "status_text": unit.status_text,
        }
    nearby_fire = [
        c
        for c in session_state.fire_cells[:80]
        if unit is not None
        and abs(c[0] - unit.position[0]) + abs(c[1] - unit.position[1]) <= 12
    ]
    local = {
        "mission": {
            "agent_id": mission.agent_id,
            "intent": mission.intent,
            "target": mission.target,
            "priority": mission.priority,
            "reason": mission.reason,
        },
        "unit": unit_blob,
        "nearby_fire_cells": nearby_fire[:24],
        "grid_size": session_state.grid_size,
        "village": session_state.village.model_dump(mode="json"),
        "wind": session_state.wind.model_dump(mode="json"),
    }
    return (
        "You are a WATCHTOWER tactical agent for ONE unit.\n"
        "Return only valid JSON with shape:\n"
        '{"unit_id": "heli-alpha", "action": "drop_water", "target_x": 4, "target_y": 12, '
        '"rationale": "brief ops reason", "radio_message": "short voice line for the crew"}\n'
        "Rules:\n"
        "- unit_id must match the mission's agent_id.\n"
        "- Helicopters: actions move | drop_water | hold_position only.\n"
        "- Ground crews: actions move | create_firebreak | hold_position only.\n"
        "- Targets must be within 0..grid_size-1.\n"
        "- radio_message: one short sentence, plain language, no JSON inside.\n"
        "- Return JSON only, no markdown.\n\n"
        f"Local tactical picture:\n{local!r}\n"
    )
