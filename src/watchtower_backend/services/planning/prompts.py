"""Prompt builders for WATCHTOWER planning."""

from __future__ import annotations

from watchtower_backend.domain.models.simulation import AirSupportPayload, SessionState


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
            "air_support_payloads": (
                [AirSupportPayload.WATER.value, AirSupportPayload.RETARDANT.value]
                if unit.id == "tower"
                else []
            ),
        }
        for unit in session_state.units
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
        "air_support_missions": [
            mission.model_dump(mode="json") for mission in session_state.air_support_missions
        ],
        "units": active_units,
    }
    return (
        "You are the WATCHTOWER wildfire command planner.\n"
        "Return only valid JSON with shape:\n"
        '{ "commands": ['
        '{"unit_id": "tower", "action": "drop_air_support", "target_x": 8, '
        '"target_y": 12, "payload_type": "retardant", "drop_start_x": 8, '
        '"drop_start_y": 9, "drop_end_x": 8, "drop_end_y": 15, '
        '"approach_points": [[4, 9], [6, 9]], "rationale": "Lay a retardant line across the head fire."}'
        ', {"unit_id": "heli-alpha", "action": "drop_water", "target_x": 4, '
        '"target_y": 12, "rationale": "Hit the lead edge."} ] }\n'
        "Rules:\n"
        "- Only command listed units.\n"
        "- Allowed actions: move, drop_water, drop_air_support, create_firebreak, hold_position.\n"
        "- Only `tower` may issue `drop_air_support`, and `tower` must not be moved.\n"
        "- `drop_air_support` may include `payload_type`, `drop_start_x`, `drop_start_y`, `drop_end_x`, `drop_end_y`, and optional `approach_points`.\n"
        "- If route geometry is omitted for `drop_air_support`, the simulation will generate it automatically.\n"
        "- Helicopters should prefer drop_water or move.\n"
        "- Ground crews should prefer create_firebreak or move.\n"
        "- Prefer retardant lines to shield the village and water drops to hit active flame directly.\n"
        "- Protect the village first.\n"
        "- Keep rationale short and concrete.\n"
        "- Return JSON only, no markdown.\n\n"
        f"Current state:\n{summary!r}\n"
    )
