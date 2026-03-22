"""Prompt builders for WATCHTOWER planning."""

from __future__ import annotations

from watchtower_backend.domain.commands import Mission
from watchtower_backend.domain.models.simulation import SessionState, UnitType
from watchtower_backend.services.planning.safety import fire_edge_context, safe_ground_candidates


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
        if unit.unit_type is not UnitType.ORCHESTRATOR and unit.is_active
    ]


def build_planner_prompt(session_state: SessionState) -> str:
    """Build the single-call planner prompt from current session state.

    Args:
        session_state: Current session state snapshot.

    Returns:
        Prompt text instructing the model to emit JSON commands.
    """
    active_units = _active_units_summary(session_state=session_state)
    fire_edge_cells, containment_cells = fire_edge_context(session_state)
    safe_ground_cells = safe_ground_candidates(session_state, limit=24)
    summary = {
        "session_id": session_state.id,
        "tick": session_state.tick,
        "grid_size": session_state.grid_size,
        "doctrine_title": session_state.doctrine.title,
        "doctrine_text": session_state.doctrine.text,
        "wind": session_state.wind.model_dump(mode="json"),
        "village": session_state.village.model_dump(mode="json"),
        "fire_cells": session_state.fire_cells[:24],
        "fire_edge_cells": fire_edge_cells[:24],
        "containment_cells": containment_cells[:24],
        "safe_ground_cells": safe_ground_cells,
        "firebreak_cells": session_state.firebreak_cells[:24],
        "units": active_units,
    }
    return (
        "Task: produce one JSON object for the WATCHTOWER wildfire simulation.\n"
        "Return only valid JSON with shape:\n"
        '{ "commands": ['
        '{"unit_id": "heli-alpha", "action": "drop_water", "target_x": 4, '
        '"target_y": 12, "rationale": "short explanation"} ] }\n'
        "Rules:\n"
        "- Only command listed units.\n"
        "- Allowed actions: move, drop_water, create_firebreak, hold_position.\n"
        "- Helicopters should prefer drop_water or move.\n"
        "- Ground crews should prefer create_firebreak or move.\n"
        "- Preserve ground crews: they cannot enter fire and should avoid routes that pinch against flame fronts or water.\n"
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
    fire_edge_cells, containment_cells = fire_edge_context(session_state)
    safe_ground_cells = safe_ground_candidates(session_state, limit=24)
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
        "fire_edge_cells": fire_edge_cells[:24],
        "containment_cells": containment_cells[:24],
        "safe_ground_cells": safe_ground_cells,
        "firebreak_cells": session_state.firebreak_cells[:24],
        "air_support_missions": [
            {
                "payload_type": mission.payload_type.value,
                "phase": mission.phase.value,
                "progress": mission.progress,
                "drop_start": mission.drop_start,
                "drop_end": mission.drop_end,
            }
            for mission in session_state.air_support_missions[:4]
        ],
        "units": active_units,
    }
    return (
        "Task: produce one JSON object for the WATCHTOWER wildfire simulation orchestrator.\n"
        "Return only valid JSON with shape:\n"
        '{ "missions": [\n'
        '  {"agent_id": "heli-alpha", "intent": "suppress", "target_x": 4, "target_y": 12, '
        '"priority": 10, "reason": "why this unit gets this mission"}\n'
        '], "air_support_requests": [\n'
        '  {"action": "call_air_support", "payload_type": "retardant", "target_x": 6, "target_y": 14, '
        '"drop_start_x": 4, "drop_start_y": 11, "drop_end_x": 8, "drop_end_y": 17, '
        '"approach_points": [{"x": -8, "y": 10}, {"x": 1, "y": 12}], '
        '"priority": 800, "rationale": "shield the village flank"}\n'
        "] }\n"
        "Rules:\n"
        "- Emit one mission per field unit listed (exclude orchestrator/tower).\n"
        "- intent: short verb phrase: suppress | firebreak | reserve | reposition | support.\n"
        "- target_x/target_y: focus cell on the grid (0..grid_size-1).\n"
        "- air_support_requests are optional and are dispatched by the tower directly.\n"
        "- Emit at most one air_support_request in a planning round.\n"
        "- If an air_support_mission is already active in the state, do not request another one yet.\n"
        "- Use air support when a straight retardant or water line will materially help contain the fire.\n"
        "- Air-support drop lines should sit on the fire edge or one cell ahead of the active front; do not center runs through the already-burning core unless there is no viable containment edge.\n"
        "- Prefer containment_cells for retardant lines and fire_edge_cells for the threatened flank.\n"
        "- Prefer safe_ground_cells for ground-crew standoff line work; ground units may act immediately from tick 0.\n"
        "- payload_type: water | retardant.\n"
        "- drop_start/drop_end are optional; omit them to let the simulation derive the run automatically.\n"
        "- approach_points may be omitted or may include off-map entry points.\n"
        "- priority: 0-1000; higher = more urgent when resolving conflicts.\n"
        "- Align missions with the player's doctrine and protect the village.\n"
        "- Ground-crew survival comes before aggressive line cutting: do not send crews through fire or across water.\n"
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
    fire_edge_cells, containment_cells = fire_edge_context(session_state)
    safe_ground_cells = safe_ground_candidates(
        session_state,
        preferred_target=mission.target,
        limit=24,
    )
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
        "fire_edge_cells": fire_edge_cells[:24],
        "safe_containment_cells": containment_cells[:24],
        "safe_ground_cells": safe_ground_cells,
        "grid_size": session_state.grid_size,
        "village": session_state.village.model_dump(mode="json"),
        "wind": session_state.wind.model_dump(mode="json"),
    }
    return (
        "Task: produce one JSON object for a single WATCHTOWER field unit.\n"
        "Return only valid JSON with shape:\n"
        '{"unit_id": "heli-alpha", "action": "drop_water", "target_x": 4, "target_y": 12, '
        '"rationale": "brief ops reason", "radio_message": "short voice line for the crew"}\n'
        "Rules:\n"
        "- unit_id must match the mission's agent_id.\n"
        "- Helicopters: actions move | drop_water | hold_position only.\n"
        "- If helicopter water_remaining is 0, do not choose drop_water.\n"
        "- Helicopter drops should hit fire_edge_cells or cells immediately ahead of the active front, not the already-burning core unless no edge is available.\n"
        "- Ground crews: actions move | create_firebreak | hold_position only.\n"
        "- Ground crews may act immediately from tick 0.\n"
        "- Ground crews must never target a burning cell.\n"
        "- Ground crews must preserve themselves first: avoid routes through flame fronts, avoid getting pinned against water, and never assume they can cross water.\n"
        "- Ground-crew firebreaks should use safe_ground_cells and safe_containment_cells just outside the fire edge, not inside the active fire.\n"
        "- Targets must be within 0..grid_size-1.\n"
        "- radio_message: one short sentence, plain language, no JSON inside.\n"
        "- Return JSON only, no markdown.\n\n"
        f"Local tactical picture:\n{local!r}\n"
    )
