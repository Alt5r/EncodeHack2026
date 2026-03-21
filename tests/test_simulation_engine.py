"""Simulation engine tests."""

from watchtower_backend.domain.commands import UnitCommand
from watchtower_backend.domain.models.simulation import (
    CommandAction,
    FireIntensity,
    TerrainCell,
    VegetationType,
    WaterType,
    WindState,
)
from watchtower_backend.services.sessions.runtime import build_initial_state
from watchtower_backend.services.simulation.engine import SimulationEngine, _CellFireState


def _make_terrain_grid(
    size: int = 24,
    vegetation: VegetationType = VegetationType.WOODLAND,
    elevation: float = 0.5,
) -> list[list[TerrainCell]]:
    """Create a uniform terrain grid for testing."""
    return [
        [TerrainCell(elevation=elevation, vegetation=vegetation, water=WaterType.NONE)]
        * size
        for _ in range(size)
    ]


def _make_engine(
    grid_size: int = 24,
    fire_cells: list[tuple[int, int]] | None = None,
    terrain_grid: list[list[TerrainCell]] | None = None,
    wind_direction: str = "NE",
    wind_speed: float = 10.0,
    seed: int = 42,
) -> SimulationEngine:
    """Create a SimulationEngine with sensible defaults for testing."""
    state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction=wind_direction, speed_mph=wind_speed),
        grid_size=grid_size,
    )
    if fire_cells is not None:
        state.fire_cells = list(fire_cells)
    state.version = 1
    if terrain_grid is None:
        terrain_grid = _make_terrain_grid(size=grid_size)
    return SimulationEngine(session_state=state, seed=seed, terrain_grid=terrain_grid)


# --- Original tests (updated for new engine signature) ---


def test_drop_water_suppresses_fire_cells() -> None:
    """Helicopters should remove fire cells when dropping water."""
    engine = _make_engine(fire_cells=[(3, 12), (4, 12), (5, 12)])

    engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
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
    """Ground crews should create durable firebreak cells."""
    engine = _make_engine(seed=7)

    engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="ground-1",
                action=CommandAction.CREATE_FIREBREAK,
                target=(10, 10),
                rationale="Defensive line.",
                state_version=1,
            )
        ]
    )

    assert (10, 10) in engine.session_state.firebreak_cells


# --- Water barrier tests ---


def test_water_blocks_fire_spread() -> None:
    """Fire should never spread to water cells."""
    grid = _make_terrain_grid(size=24)
    # Place a river wall at column 5
    for row in range(24):
        grid[row][5] = TerrainCell(elevation=0.3, vegetation=VegetationType.WOODLAND, water=WaterType.WATER)

    # Fire starts at (10, 4) — river is at column 5
    engine = _make_engine(fire_cells=[(10, 4)], terrain_grid=grid, seed=1)

    # Run many ticks to give fire every chance to cross
    for _ in range(30):
        engine.step(commands=[])

    # No fire cell should be at column 5 (river) or beyond
    for cell in engine.session_state.fire_cells:
        assert cell[1] < 5, f"Fire crossed river to {cell}"


def test_water_proximity_increases_moisture() -> None:
    """Cells adjacent to water should have higher moisture, reducing spread chance."""
    grid = _make_terrain_grid(size=24)
    # Place lake at (10, 10)
    grid[10][10] = TerrainCell(elevation=0.3, vegetation=VegetationType.WOODLAND, water=WaterType.WATER)

    engine = _make_engine(terrain_grid=grid)

    # Adjacent cell should have boosted moisture
    moisture = engine._get_cell_moisture((10, 11))
    assert moisture >= 0.7, f"Expected moisture >= 0.7 near water, got {moisture}"

    # Cell 2 away should have moderate boost
    moisture_2 = engine._get_cell_moisture((10, 12))
    assert moisture_2 >= 0.5, f"Expected moisture >= 0.5 within 2 cells of water, got {moisture_2}"

    # Cell 3 away should have base moisture
    moisture_3 = engine._get_cell_moisture((10, 13))
    assert moisture_3 == 0.3, f"Expected base moisture 0.3 far from water, got {moisture_3}"


# --- Wind directionality tests ---


def test_wind_favours_downwind_spread() -> None:
    """Fire should spread more in the wind direction than against it."""
    grid = _make_terrain_grid(size=24, vegetation=VegetationType.FOREST)

    # Fire at center, strong east wind
    downwind_count = 0
    upwind_count = 0
    trials = 50

    for trial in range(trials):
        engine = _make_engine(
            fire_cells=[(12, 12)],
            terrain_grid=grid,
            wind_direction="E",
            wind_speed=20.0,
            seed=trial,
        )
        engine.step(commands=[])
        for cell in engine.session_state.fire_cells:
            if cell == (12, 12):
                continue
            if cell[0] == 12 and cell[1] > 12:
                downwind_count += 1  # East (with wind)
            if cell[0] == 12 and cell[1] < 12:
                upwind_count += 1  # West (against wind)

    assert downwind_count > upwind_count, (
        f"Wind should favour downwind: downwind={downwind_count}, upwind={upwind_count}"
    )


# --- Slope tests ---


def test_fire_spreads_faster_uphill() -> None:
    """Fire should spread faster uphill than downhill."""
    size = 24
    # Create terrain with elevation gradient: low at row 0, high at row 23
    grid = [
        [
            TerrainCell(
                elevation=row / (size - 1),
                vegetation=VegetationType.FOREST,
                water=WaterType.NONE,
            )
            for _ in range(size)
        ]
        for row in range(size)
    ]

    uphill_spread = 0
    downhill_spread = 0
    trials = 50

    for trial in range(trials):
        engine = _make_engine(
            fire_cells=[(12, 12)],
            terrain_grid=grid,
            wind_direction="E",  # Wind perpendicular to slope
            wind_speed=0.0,  # No wind to isolate slope effect
            seed=trial + 100,
        )
        engine.step(commands=[])
        for cell in engine.session_state.fire_cells:
            if cell == (12, 12):
                continue
            if cell[0] > 12:
                uphill_spread += 1
            elif cell[0] < 12:
                downhill_spread += 1

    assert uphill_spread > downhill_spread, (
        f"Fire should race uphill: uphill={uphill_spread}, downhill={downhill_spread}"
    )


# --- Vegetation tests ---


def test_forest_burns_more_than_clearing() -> None:
    """Forest vegetation should allow more fire spread than clearings."""
    size = 24
    forest_spread = 0
    clearing_spread = 0
    trials = 50

    for trial in range(trials):
        forest_grid = _make_terrain_grid(size=size, vegetation=VegetationType.FOREST)
        engine = _make_engine(
            fire_cells=[(12, 12)], terrain_grid=forest_grid, seed=trial + 200
        )
        engine.step(commands=[])
        forest_spread += len(engine.session_state.fire_cells) - 1

    for trial in range(trials):
        clearing_grid = _make_terrain_grid(size=size, vegetation=VegetationType.CLEARING)
        engine = _make_engine(
            fire_cells=[(12, 12)], terrain_grid=clearing_grid, seed=trial + 200
        )
        engine.step(commands=[])
        clearing_spread += len(engine.session_state.fire_cells) - 1

    assert forest_spread > clearing_spread, (
        f"Forest should burn more: forest={forest_spread}, clearing={clearing_spread}"
    )


# --- Diagonal spread tests ---


def test_diagonal_spread_is_less_likely() -> None:
    """Diagonal spread should be penalized compared to cardinal directions."""
    grid = _make_terrain_grid(size=24, vegetation=VegetationType.FOREST)

    cardinal_count = 0
    diagonal_count = 0
    trials = 200

    for trial in range(trials):
        engine = _make_engine(
            fire_cells=[(12, 12)],
            terrain_grid=grid,
            wind_speed=0.0,
            seed=trial + 300,
        )
        engine.step(commands=[])
        for cell in engine.session_state.fire_cells:
            if cell == (12, 12):
                continue
            dx = abs(cell[0] - 12)
            dy = abs(cell[1] - 12)
            if dx == 1 and dy == 1:
                diagonal_count += 1
            else:
                cardinal_count += 1

    # 4 cardinal vs 4 diagonal neighbours, but diagonal should have fewer hits
    # Normalize by number of possible directions
    cardinal_per_dir = cardinal_count / 4.0
    diagonal_per_dir = diagonal_count / 4.0
    assert cardinal_per_dir > diagonal_per_dir, (
        f"Cardinal should spread more per-direction: "
        f"cardinal/dir={cardinal_per_dir:.1f}, diagonal/dir={diagonal_per_dir:.1f}"
    )


# --- Intensity progression tests ---


def test_intensity_progresses_over_ticks() -> None:
    """Fire should progress from EMBER to BURNING after 2 ticks."""
    engine = _make_engine(fire_cells=[(12, 12)])

    # Tick 1: should be EMBER (just started)
    engine.step(commands=[])
    fire_state = engine._fire_states.get((12, 12))
    assert fire_state is not None
    assert fire_state.intensity == FireIntensity.EMBER

    # Tick 2: burn_ticks becomes 2, should advance to BURNING
    engine.step(commands=[])
    fire_state = engine._fire_states.get((12, 12))
    if fire_state is not None:
        assert fire_state.intensity == FireIntensity.BURNING


def test_forest_reaches_inferno() -> None:
    """Forest cells with enough fuel should reach INFERNO at tick 5+."""
    grid = _make_terrain_grid(size=24, vegetation=VegetationType.FOREST)
    engine = _make_engine(fire_cells=[(12, 12)], terrain_grid=grid)

    # Run 6 ticks to pass the inferno threshold
    for _ in range(6):
        engine.step(commands=[])

    fire_state = engine._fire_states.get((12, 12))
    if fire_state is not None and fire_state.fuel > 0:
        assert fire_state.intensity == FireIntensity.INFERNO


# --- Fuel consumption and burn-out tests ---


def test_fuel_depletes_over_time() -> None:
    """Burning cells should consume fuel each tick."""
    engine = _make_engine(fire_cells=[(12, 12)])

    engine.step(commands=[])
    fire_state = engine._fire_states.get((12, 12))
    assert fire_state is not None
    initial_fuel = fire_state.fuel

    engine.step(commands=[])
    fire_state = engine._fire_states.get((12, 12))
    if fire_state is not None:
        assert fire_state.fuel < initial_fuel


def test_clearing_burns_out_fast() -> None:
    """Clearing cells (fuel=0.2) should burn out within ~5 ticks."""
    grid = _make_terrain_grid(size=24, vegetation=VegetationType.CLEARING)
    engine = _make_engine(fire_cells=[(12, 12)], terrain_grid=grid)

    for _ in range(8):
        engine.step(commands=[])

    # Cell should have burned out and moved to burned_cells
    assert (12, 12) not in engine.session_state.fire_cells
    assert (12, 12) in engine.session_state.burned_cells


def test_burned_out_cells_stop_spreading() -> None:
    """Burned-out cells should not spread fire."""
    grid = _make_terrain_grid(size=24, vegetation=VegetationType.CLEARING)
    engine = _make_engine(fire_cells=[(12, 12)], terrain_grid=grid)

    # Run until the cell burns out
    for _ in range(10):
        engine.step(commands=[])

    assert (12, 12) in engine.session_state.burned_cells
    assert (12, 12) not in engine._fire_states


# --- Intensity-aware suppression tests ---


def test_inferno_resists_suppression() -> None:
    """INFERNO cells should resist water drops ~50% of the time."""
    grid = _make_terrain_grid(size=24, vegetation=VegetationType.FOREST)

    suppressed_count = 0
    trials = 100

    for trial in range(trials):
        engine = _make_engine(
            fire_cells=[(12, 12)],
            terrain_grid=grid,
            seed=trial + 500,
        )
        # Manually set to INFERNO for testing
        fire_state = engine._fire_states[(12, 12)]
        fire_state.intensity = FireIntensity.INFERNO
        fire_state.burn_ticks = 6
        fire_state.fuel = 0.8

        suppressed = engine._suppress_fire(center=(12, 12), radius=2)
        if (12, 12) in suppressed:
            suppressed_count += 1

    # Should be roughly 50% (allow range 30-70%)
    assert 30 <= suppressed_count <= 70, (
        f"INFERNO suppression should be ~50%, got {suppressed_count}%"
    )


def test_ember_always_suppressed() -> None:
    """EMBER cells should always be suppressed by water drops."""
    grid = _make_terrain_grid(size=24, vegetation=VegetationType.FOREST)

    for trial in range(20):
        engine = _make_engine(
            fire_cells=[(12, 12)],
            terrain_grid=grid,
            seed=trial + 600,
        )
        suppressed = engine._suppress_fire(center=(12, 12), radius=2)
        assert (12, 12) in suppressed, f"EMBER should always be suppressed (trial {trial})"


# --- Firebreak still works ---


def test_firebreak_blocks_terrain_aware_spread() -> None:
    """Firebreaks should still block fire even with terrain-aware spread."""
    grid = _make_terrain_grid(size=24, vegetation=VegetationType.FOREST)
    engine = _make_engine(fire_cells=[(12, 12)], terrain_grid=grid, seed=42)

    # Place firebreak wall around the fire
    for offset in range(-2, 3):
        engine.session_state.firebreak_cells.append((12 + offset, 10))
        engine.session_state.firebreak_cells.append((12 + offset, 14))
        engine.session_state.firebreak_cells.append((10, 12 + offset))
        engine.session_state.firebreak_cells.append((14, 12 + offset))

    # Run many ticks
    for _ in range(20):
        engine.step(commands=[])

    # Fire should not escape the firebreak box
    for cell in engine.session_state.fire_cells:
        assert 10 < cell[0] < 14 and 10 < cell[1] < 14, (
            f"Fire escaped firebreak to {cell}"
        )
