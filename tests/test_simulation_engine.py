"""Simulation engine tests."""

from watchtower_backend.domain.commands import UnitCommand
from watchtower_backend.domain.models.simulation import (
    AirSupportPayload,
    AirSupportPhase,
    CommandAction,
    FireIntensity,
    TerrainCell,
    TreatedCellState,
    VegetationType,
    WaterType,
    WindState,
)
from watchtower_backend.services.sessions.runtime import build_initial_state
from watchtower_backend.services.simulation.air_support import (
    build_drop_corridor,
    get_mission_progress_per_tick,
)
from watchtower_backend.services.simulation.engine import SimulationEngine


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
    heli = next(unit for unit in engine.session_state.units if unit.id == "heli-alpha")
    heli.position = (4, 12)

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


def test_drop_water_waits_until_helicopter_reaches_target() -> None:
    """Suppression should not execute until the helicopter arrives on station."""
    engine = _make_engine(fire_cells=[(4, 12), (5, 12), (6, 12)], seed=24)
    heli = next(unit for unit in engine.session_state.units if unit.id == "heli-alpha")
    starting_water = heli.water_remaining

    mutations = engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="heli-alpha",
                action=CommandAction.DROP_WATER,
                target=(5, 12),
                rationale="Do not release until on target.",
                state_version=1,
            )
        ]
    )

    heli = next(unit for unit in engine.session_state.units if unit.id == "heli-alpha")
    assert not any(mutation["kind"] == "water_drop" for mutation in mutations)
    assert heli.water_remaining == starting_water
    assert heli.target == (5, 12)
    assert heli.status_text == "suppressing"


def test_firebreak_blocks_immediate_spread() -> None:
    """Ground crews should create durable firebreak cells once in position."""
    engine = _make_engine(seed=7)
    ground = next(unit for unit in engine.session_state.units if unit.id == "ground-1")
    ground.position = (10, 10)

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


def test_firebreak_waits_until_ground_crew_reaches_target() -> None:
    """Ground crews should not lay a firebreak before arriving at the target."""
    engine = _make_engine(seed=8)

    mutations = engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="ground-1",
                action=CommandAction.CREATE_FIREBREAK,
                target=(10, 10),
                rationale="Travel first, then cut line.",
                state_version=1,
            )
        ]
    )

    ground = next(unit for unit in engine.session_state.units if unit.id == "ground-1")
    assert not any(mutation["kind"] == "firebreak_created" for mutation in mutations)
    assert (10, 10) not in engine.session_state.firebreak_cells
    assert ground.target == (10, 10)
    assert ground.status_text == "laying firebreak"


def test_ground_crews_keep_advancing_between_commands() -> None:
    """Ground crews should keep moving toward their assigned target every tick."""
    engine = _make_engine(seed=11)

    engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="ground-1",
                action=CommandAction.MOVE,
                target=(8, 8),
                rationale="Redeploy to the west flank.",
                state_version=1,
            )
        ]
    )
    ground = next(unit for unit in engine.session_state.units if unit.id == "ground-1")
    assert ground.position == (14, 14)
    assert ground.target == (8, 8)
    assert ground.status_text == "moving"

    engine.step(commands=[])
    ground = next(unit for unit in engine.session_state.units if unit.id == "ground-1")
    assert ground.position == (12, 12)
    assert ground.target == (8, 8)
    assert ground.status_text == "moving"


def test_ground_crew_speed_does_not_change_fire_spread_timing() -> None:
    """Speeding crews up must not alter the fire progression tick."""
    baseline = _make_engine(fire_cells=[(12, 12)], seed=31)
    moving = _make_engine(fire_cells=[(12, 12)], seed=31)

    baseline.step(commands=[])
    moving.step(
        commands=[
            UnitCommand(
                session_id=moving.session_state.id,
                unit_id="ground-1",
                action=CommandAction.MOVE,
                target=(8, 8),
                rationale="Move without affecting fire behavior.",
                state_version=1,
            )
        ]
    )

    assert sorted(moving.session_state.fire_cells) == sorted(baseline.session_state.fire_cells)
    assert moving.session_state.tick == baseline.session_state.tick == 1


def test_ground_crews_cannot_move_into_active_fire() -> None:
    """Ground crews must never be ordered directly into burning cells."""
    engine = _make_engine(fire_cells=[(12, 12)], seed=32)
    ground = next(unit for unit in engine.session_state.units if unit.id == "ground-1")
    start = ground.position

    mutations = engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="ground-1",
                action=CommandAction.MOVE,
                target=(12, 12),
                rationale="Unsafe move into the fire core.",
                state_version=1,
            )
        ]
    )

    ground = next(unit for unit in engine.session_state.units if unit.id == "ground-1")
    assert any(mutation["kind"] == "command_rejected" for mutation in mutations)
    assert ground.position == start


def test_ground_crews_cannot_cut_firebreaks_through_active_fire() -> None:
    """Firebreak targets that overlap live fire should be rejected."""
    engine = _make_engine(fire_cells=[(10, 10)], seed=33)

    mutations = engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="ground-1",
                action=CommandAction.CREATE_FIREBREAK,
                target=(10, 10),
                rationale="Unsafe break through the fire.",
                state_version=1,
            )
        ]
    )

    assert any(mutation["kind"] == "command_rejected" for mutation in mutations)
    assert (10, 10) not in engine.session_state.firebreak_cells


def test_ground_crews_route_around_fire_instead_of_cutting_through_it() -> None:
    """Ground crews should route around burning cells rather than driving through them."""
    engine = _make_engine(fire_cells=[(14, 15)], seed=34)

    engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="ground-1",
                action=CommandAction.MOVE,
                target=(14, 12),
                rationale="Wrap around the flame edge.",
                state_version=1,
            )
        ]
    )

    ground = next(unit for unit in engine.session_state.units if unit.id == "ground-1")
    assert ground.position != (14, 14)
    assert ground.position != (14, 15)
    assert ground.position not in engine.session_state.fire_cells
    assert ground.is_active


def test_ground_crews_cannot_cut_diagonally_between_fire_cells() -> None:
    """Ground crews should not corner-cut through a diagonal gap beside live fire."""
    engine = _make_engine(fire_cells=[(14, 15), (15, 14)], seed=39)

    engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="ground-1",
                action=CommandAction.MOVE,
                target=(14, 12),
                rationale="Try to squeeze through the fire corner.",
                state_version=1,
            )
        ]
    )

    ground = next(unit for unit in engine.session_state.units if unit.id == "ground-1")
    assert ground.position != (14, 14)
    assert ground.position not in engine.session_state.fire_cells


def test_ground_crews_die_when_fire_reaches_their_cell() -> None:
    """Ground crews should be marked lost if live fire overruns their position."""
    engine = _make_engine(fire_cells=[(14, 16)], seed=35)

    mutations = engine.step(commands=[])

    ground = next(unit for unit in engine.session_state.units if unit.id == "ground-1")
    assert any(mutation["kind"] == "unit_killed" for mutation in mutations)
    assert not ground.is_active
    assert ground.status_text == "lost"
    assert ground.target is None


def test_ground_crews_cannot_cross_water_even_if_target_is_safe() -> None:
    """Water should make a ground target unreachable rather than traversable."""
    grid = _make_terrain_grid(size=24)
    for row in range(24):
        grid[row][15] = TerrainCell(
            elevation=0.2,
            vegetation=VegetationType.MEADOW,
            water=WaterType.WATER,
        )
    engine = _make_engine(terrain_grid=grid, seed=36)
    ground = next(unit for unit in engine.session_state.units if unit.id == "ground-1")
    start = ground.position

    mutations = engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="ground-1",
                action=CommandAction.MOVE,
                target=(16, 12),
                rationale="Attempt a route across the river.",
                state_version=1,
            )
        ]
    )

    ground = next(unit for unit in engine.session_state.units if unit.id == "ground-1")
    assert any(mutation["kind"] == "command_rejected" for mutation in mutations)
    assert ground.position == start
    assert ground.target is None


def test_ground_crews_slow_down_near_water_even_without_crossing_it() -> None:
    """Water-adjacent movement should be slower than open-ground travel."""
    baseline = _make_engine(seed=37)
    baseline.step(
        commands=[
            UnitCommand(
                session_id=baseline.session_state.id,
                unit_id="ground-1",
                action=CommandAction.MOVE,
                target=(14, 12),
                rationale="Open-ground traverse.",
                state_version=1,
            )
        ]
    )
    baseline_ground = next(unit for unit in baseline.session_state.units if unit.id == "ground-1")

    river_edge_grid = _make_terrain_grid(size=24)
    river_edge_grid[13][15] = TerrainCell(
        elevation=0.2,
        vegetation=VegetationType.MEADOW,
        water=WaterType.WATER,
    )
    slowed = _make_engine(terrain_grid=river_edge_grid, seed=37)
    slowed.step(
        commands=[
            UnitCommand(
                session_id=slowed.session_state.id,
                unit_id="ground-1",
                action=CommandAction.MOVE,
                target=(14, 12),
                rationale="Skirt the river edge.",
                state_version=1,
            )
        ]
    )
    slowed_ground = next(unit for unit in slowed.session_state.units if unit.id == "ground-1")

    baseline_remaining = abs(baseline_ground.position[0] - 14) + abs(baseline_ground.position[1] - 12)
    slowed_remaining = abs(slowed_ground.position[0] - 14) + abs(slowed_ground.position[1] - 12)

    assert baseline_ground.position == (14, 14)
    assert slowed_remaining > baseline_remaining


# --- Water barrier tests ---


def test_water_blocks_fire_spread() -> None:
    """Fire should never spread to water cells."""
    grid = _make_terrain_grid(size=24)
    # Place a river wall at column 5
    for row in range(24):
        grid[row][5] = TerrainCell(
            elevation=0.3,
            vegetation=VegetationType.WOODLAND,
            water=WaterType.WATER,
        )

    # Coordinates are (x, y), so this is column 4, row 10.
    engine = _make_engine(fire_cells=[(4, 10)], terrain_grid=grid, seed=1)

    # Run many ticks to give fire every chance to cross
    for _ in range(30):
        engine.step(commands=[])

    # No fire cell should be at column 5 (river) or beyond
    for cell in engine.session_state.fire_cells:
        assert cell[0] < 5, f"Fire crossed river to {cell}"


def test_fire_cannot_spread_diagonally_across_water_corners() -> None:
    """Diagonal spread must not hop across a one-cell water corner."""
    grid = _make_terrain_grid(size=24)
    grid[11][12] = TerrainCell(
        elevation=0.3,
        vegetation=VegetationType.WOODLAND,
        water=WaterType.WATER,
    )
    grid[12][11] = TerrainCell(
        elevation=0.3,
        vegetation=VegetationType.WOODLAND,
        water=WaterType.WATER,
    )

    engine = _make_engine(fire_cells=[(11, 11)], terrain_grid=grid, seed=38)

    for _ in range(12):
        engine.step(commands=[])

    assert (12, 12) not in engine.session_state.fire_cells


def test_water_proximity_increases_moisture() -> None:
    """Cells adjacent to water should have higher moisture, reducing spread chance."""
    grid = _make_terrain_grid(size=24)
    # Place lake at (10, 10)
    grid[10][10] = TerrainCell(
        elevation=0.3,
        vegetation=VegetationType.WOODLAND,
        water=WaterType.WATER,
    )

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
        engine.session_state.tick = 10
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
        engine.session_state.tick = 10
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


def test_call_air_support_biases_requested_geometry_to_fire_edge() -> None:
    """Planner-provided drop runs should be nudged off the fire core toward containment."""
    engine = _make_engine(
        fire_cells=[
            (10, 10), (10, 11), (10, 12),
            (11, 10), (11, 11), (11, 12),
            (12, 10), (12, 11), (12, 12),
        ],
        seed=11,
    )
    original_start = (8, 8)
    original_end = (14, 14)

    engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="tower",
                action=CommandAction.CALL_AIR_SUPPORT,
                target=(11, 11),
                rationale="Lay retardant ahead of the fire front.",
                state_version=1,
                air_support_payload=AirSupportPayload.RETARDANT,
                approach_points=[(-8, 10), (1, 10)],
                drop_start=original_start,
                drop_end=original_end,
            )
        ]
    )

    assert len(engine.session_state.air_support_missions) == 1
    mission = engine.session_state.air_support_missions[0]
    assert mission.payload_type is AirSupportPayload.RETARDANT
    assert mission.phase is AirSupportPhase.APPROACH
    assert mission.progress == 0.0
    original_overlap = sum(
        1
        for cell in build_drop_corridor(original_start, original_end, engine.session_state.grid_size, 1)
        if cell in set(engine.session_state.fire_cells)
    )
    actual_overlap = sum(
        1
        for cell in build_drop_corridor(mission.drop_start, mission.drop_end, engine.session_state.grid_size, 1)
        if cell in set(engine.session_state.fire_cells)
    )
    assert actual_overlap < original_overlap
    assert actual_overlap <= 2
    assert mission.approach_points[-1] == mission.drop_start


def test_air_support_exit_phase_is_slower_than_the_drop_run() -> None:
    """Post-drop exit should stay visibly slower than the bombing run itself."""
    assert get_mission_progress_per_tick(AirSupportPhase.EXIT) == 0.2
    assert get_mission_progress_per_tick(AirSupportPhase.EXIT) < get_mission_progress_per_tick(
        AirSupportPhase.DROP
    )


def test_air_support_drop_creates_treated_cells() -> None:
    """An air-support mission should create lingering treated terrain on the containment run."""
    engine = _make_engine(fire_cells=[(10, 10), (11, 11), (12, 12)], seed=12)

    engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="tower",
                action=CommandAction.CALL_AIR_SUPPORT,
                target=(11, 11),
                rationale="Lay retardant ahead of the fire front.",
                state_version=1,
                air_support_payload=AirSupportPayload.RETARDANT,
                drop_start=(8, 8),
                drop_end=(14, 14),
            )
        ]
    )
    engine.step(commands=[])
    mutations = engine.step(commands=[])

    assert any(mutation["kind"] == "air_support_drop" for mutation in mutations)
    assert engine.session_state.treated_cells
    treated_coordinates = {cell.coordinate for cell in engine.session_state.treated_cells}
    fire_coordinates = set(engine.session_state.fire_cells)
    outside_fire = treated_coordinates - fire_coordinates
    inside_fire = treated_coordinates & fire_coordinates
    assert outside_fire
    assert len(outside_fire) > len(inside_fire)
    assert engine.session_state.air_support_missions
    assert engine.session_state.air_support_missions[0].phase is AirSupportPhase.DROP


def test_treated_cells_reduce_spread_probability() -> None:
    """Retardant-treated cells should become materially harder to ignite."""
    engine = _make_engine(
        fire_cells=[(12, 12)],
        terrain_grid=_make_terrain_grid(size=24, vegetation=VegetationType.FOREST),
        wind_speed=0.0,
        seed=13,
    )
    source = (12, 12)
    target = (12, 13)
    source_terrain = engine._get_terrain(source)
    target_terrain = engine._get_terrain(target)
    fire_state = engine._fire_states[source]

    untreated_probability = engine._calc_spread_probability(
        source=source,
        target=target,
        source_terrain=source_terrain,
        target_terrain=target_terrain,
        fire_state=fire_state,
        wind_vec=(0.0, 0.0),
        wind_speed=0.0,
        is_diagonal=False,
    )

    engine.session_state.treated_cells = [
        TreatedCellState(
            coordinate=target,
            payload_type=AirSupportPayload.RETARDANT,
            strength=1.0,
            remaining_ticks=10,
        )
    ]

    treated_probability = engine._calc_spread_probability(
        source=source,
        target=target,
        source_terrain=source_terrain,
        target_terrain=target_terrain,
        fire_state=fire_state,
        wind_vec=(0.0, 0.0),
        wind_speed=0.0,
        is_diagonal=False,
    )

    assert treated_probability < untreated_probability


def test_invalid_command_does_not_freeze_air_support_progress() -> None:
    """Rejected unit commands must not stop active aircraft missions from advancing."""
    engine = _make_engine(fire_cells=[(10, 10), (11, 11)], seed=14)
    heli = next(unit for unit in engine.session_state.units if unit.id == "heli-alpha")
    heli.water_remaining = 0

    engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="tower",
                action=CommandAction.CALL_AIR_SUPPORT,
                target=(11, 11),
                rationale="Lay retardant ahead of the fire front.",
                state_version=1,
                air_support_payload=AirSupportPayload.RETARDANT,
                drop_start=(8, 8),
                drop_end=(14, 14),
            )
        ]
    )

    mutations = engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="heli-alpha",
                action=CommandAction.DROP_WATER,
                target=(10, 10),
                rationale="Invalid because the helicopter is dry.",
                state_version=2,
            )
        ]
    )

    assert any(mutation["kind"] == "command_rejected" for mutation in mutations)
    assert len(engine.session_state.air_support_missions) == 1
    assert engine.session_state.air_support_missions[0].phase is AirSupportPhase.APPROACH
    assert engine.session_state.air_support_missions[0].progress > 0


def test_only_one_air_support_mission_can_be_active() -> None:
    """Live agent air support should behave like the fallback path: one run at a time."""
    engine = _make_engine(fire_cells=[(10, 10), (11, 11)], seed=15)

    engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="tower",
                action=CommandAction.CALL_AIR_SUPPORT,
                target=(11, 11),
                rationale="First run.",
                state_version=1,
                air_support_payload=AirSupportPayload.RETARDANT,
                drop_start=(8, 8),
                drop_end=(14, 14),
            )
        ]
    )

    mutations = engine.step(
        commands=[
            UnitCommand(
                session_id=engine.session_state.id,
                unit_id="tower",
                action=CommandAction.CALL_AIR_SUPPORT,
                target=(12, 12),
                rationale="Second run should be deferred.",
                state_version=2,
                air_support_payload=AirSupportPayload.WATER,
                drop_start=(9, 9),
                drop_end=(15, 15),
            )
        ]
    )

    assert len(engine.session_state.air_support_missions) == 1
    assert any(
        mutation["kind"] == "command_rejected"
        and "Air-support mission already active" in str(mutation["reason"])
        for mutation in mutations
    )
