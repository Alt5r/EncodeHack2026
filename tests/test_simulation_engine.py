"""Simulation engine tests."""

from watchtower_backend.domain.commands import UnitCommand
from watchtower_backend.domain.models.simulation import CommandAction, WindState
from watchtower_backend.services.sessions.runtime import build_initial_state
from watchtower_backend.services.simulation.engine import SimulationEngine


def test_drop_water_suppresses_fire_cells() -> None:
    """Helicopters should remove fire cells when dropping water.

    Returns:
        None.
    """
    state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    state.fire_cells = [(3, 12), (4, 12), (5, 12)]
    state.version = 1
    engine = SimulationEngine(session_state=state, seed=42)

    engine.step(
        commands=[
            UnitCommand(
                session_id=state.id,
                unit_id="heli-alpha",
                action=CommandAction.DROP_WATER,
                target=(4, 12),
                rationale="Suppress the lead edge.",
                state_version=1,
            )
        ]
    )

    assert len(engine.session_state.fire_cells) < 3
    assert engine.session_state.score.suppressed_cells >= 1


def test_firebreak_blocks_immediate_spread() -> None:
    """Ground crews should create durable firebreak cells.

    Returns:
        None.
    """
    state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    state.version = 1
    engine = SimulationEngine(session_state=state, seed=7)

    engine.step(
        commands=[
            UnitCommand(
                session_id=state.id,
                unit_id="ground-1",
                action=CommandAction.CREATE_FIREBREAK,
                target=(10, 10),
                rationale="Defensive line.",
                state_version=1,
            )
        ]
    )

    assert (10, 10) in engine.session_state.firebreak_cells
