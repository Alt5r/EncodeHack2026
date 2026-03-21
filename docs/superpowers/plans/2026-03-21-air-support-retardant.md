# WATCHTOWER Air Support And Retardant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add transient fixed-wing air-support missions with visible approach/drop runs, treated terrain effects, and fire-spread reduction in both the backend simulation and the frontend fallback/rendering path.

**Architecture:** Extend the authoritative simulation state with a separate transient mission layer plus durable treated-tile metadata, then mirror those shapes through the API, frontend adapters, and mock-session fallback. Keep helicopters and ground crews unchanged, and render the new aircraft/path/effect data as additive overlays on the existing map canvas.

**Tech Stack:** Python + Pydantic backend models, FastAPI session schemas, TypeScript React client components, canvas rendering in `MapCanvas.tsx`, existing Next.js App Router frontend, pytest, ESLint, Next.js build.

---

## File Structure

### Backend

- Create: `src/watchtower_backend/services/simulation/air_support.py`
  - Owns fixed-wing mission geometry helpers, straight-run rasterization, fallback route generation, and treated-cell decay helpers so `engine.py` does not absorb all of that logic.
- Modify: `src/watchtower_backend/domain/models/simulation.py`
  - Add air-support enums/models and session-state fields for missions and treated cells.
- Modify: `src/watchtower_backend/domain/commands.py`
  - Extend command payloads so planners can describe optional route geometry and payload type.
- Modify: `src/watchtower_backend/api/schemas/sessions.py`
  - Expose new mission and treated-cell state through API responses.
- Modify: `src/watchtower_backend/services/simulation/engine.py`
  - Apply command handling, mission lifecycle advancement, treated-cell decay, direct-hit suppression, and spread resistance.
- Modify: `src/watchtower_backend/services/planning/schemas.py`
  - Allow structured planner output to carry air-support geometry.
- Modify: `src/watchtower_backend/services/planning/prompts.py`
  - Teach the planner about the new action and payload/geometry fields.
- Modify: `src/watchtower_backend/services/planning/orchestrator.py`
  - Add deterministic fallback air-support planning when no LLM geometry is available.
- Modify: `src/watchtower_backend/services/sessions/runtime.py`
  - Seed the initial session state cleanly with empty mission/treatment layers.

### Frontend

- Modify: `src/lib/types.ts`
  - Add mission, payload, aircraft-model, and treated-tile shapes to the client state model.
- Modify: `src/lib/adapt.ts`
  - Convert backend snapshots into frontend air-support and treated-tile data.
- Create: `src/lib/air-support.ts`
  - Shared frontend helpers for mission interpolation, straight-run coverage, aircraft metadata, and overlay styling.
- Modify: `src/lib/mock-fire-simulation.ts`
  - Mirror treated-tile logic and transient mission progression for the `mock-session` path.
- Modify: `src/components/MapCanvas.tsx`
  - Render aircraft silhouettes, approach/drop routes, falling payload, and treated-tile strips.
- Modify: `src/app/page.tsx`
  - Preserve existing page behavior while passing the richer session state through unchanged.

### Tests

- Modify: `tests/test_simulation_engine.py`
  - Add test coverage for mission creation, fallback routes, direct-hit suppression, treated-cell decay, and spread reduction.
- Modify: `tests/test_planner.py`
  - Verify planner payload parsing and heuristic fallback mission generation.
- Modify: `tests/test_api.py`
  - Verify session detail exposes the new fields without breaking lifecycle behavior.

## Task 1: Extend Backend State And API Shapes

**Files:**
- Create: None
- Modify: `src/watchtower_backend/domain/models/simulation.py`
- Modify: `src/watchtower_backend/domain/commands.py`
- Modify: `src/watchtower_backend/api/schemas/sessions.py`
- Modify: `src/watchtower_backend/services/sessions/runtime.py`
- Test: `tests/test_api.py`

- [ ] **Step 1: Write the failing API/state test**

```python
def test_session_detail_includes_air_support_layers(monkeypatch, tmp_path):
    monkeypatch.setenv("WATCHTOWER_DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("WATCHTOWER_REPLAY_DIRECTORY", str(tmp_path / "replays"))
    get_settings.cache_clear()

    with TestClient(create_app()) as client:
        response = client.post("/api/v1/sessions", json={"doctrine_text": "Protect the village."})
        body = response.json()
        assert body["air_support_missions"] == []
        assert body["treated_cells"] == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_api.py::test_session_detail_includes_air_support_layers -v`
Expected: FAIL because `SessionDetail` does not expose `air_support_missions` or `treated_cells`.

- [ ] **Step 3: Add the minimal domain and schema fields**

```python
class AirSupportPayload(StrEnum):
    WATER = "water"
    RETARDANT = "retardant"


class AirSupportMission(BaseModel):
    id: str
    aircraft_model: str
    payload_type: AirSupportPayload
    approach_points: list[Coordinate] = Field(default_factory=list)
    drop_start: Coordinate
    drop_end: Coordinate
    progress: float = Field(default=0.0, ge=0.0, le=1.0)


class TreatedCellState(BaseModel):
    coordinate: Coordinate
    payload_type: AirSupportPayload
    strength: float = Field(ge=0.0, le=1.0)
    remaining_ticks: int = Field(ge=0)
```

- [ ] **Step 4: Wire the new fields into session snapshots**

Run: `pytest tests/test_api.py::test_session_detail_includes_air_support_layers -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/test_api.py src/watchtower_backend/domain/models/simulation.py src/watchtower_backend/domain/commands.py src/watchtower_backend/api/schemas/sessions.py src/watchtower_backend/services/sessions/runtime.py
git commit -m "feat: add air support state models"
```

## Task 2: Add Air-Support Geometry And Backend Engine Logic

**Files:**
- Create: `src/watchtower_backend/services/simulation/air_support.py`
- Modify: `src/watchtower_backend/services/simulation/engine.py`
- Test: `tests/test_simulation_engine.py`

- [ ] **Step 1: Write failing engine tests for treated cells and fallback routes**

```python
def test_air_support_drop_creates_treated_cells():
    engine = _make_engine(fire_cells=[(12, 12), (12, 13)])
    engine.step(commands=[_make_air_support_command()])
    assert engine.session_state.treated_cells


def test_treated_retardant_cells_reduce_spread_probability():
    grid = _make_terrain_grid(size=24, vegetation=VegetationType.FOREST)
    engine = _make_engine(fire_cells=[(12, 12)], terrain_grid=grid)
    fire_state = _CellFireState(fuel=1.0, moisture=0.3)
    source = (12, 12)
    target = (12, 13)
    base = engine._calc_spread_probability(
        source=source,
        target=target,
        source_terrain=grid[12][12],
        target_terrain=grid[12][13],
        fire_state=fire_state,
        wind_vec=(0.0, 0.0),
        wind_speed=0.0,
        is_diagonal=False,
    )
    engine._session_state.treated_cells = [
        TreatedCellState(
            coordinate=target,
            payload_type=AirSupportPayload.RETARDANT,
            strength=1.0,
            remaining_ticks=12,
        )
    ]
    reduced = engine._calc_spread_probability(
        source=source,
        target=target,
        source_terrain=grid[12][12],
        target_terrain=grid[12][13],
        fire_state=fire_state,
        wind_vec=(0.0, 0.0),
        wind_speed=0.0,
        is_diagonal=False,
    )
    assert reduced < base
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_simulation_engine.py -k "air_support or treated" -v`
Expected: FAIL because the engine has no air-support command handling or treated-cell resistance.

- [ ] **Step 3: Implement geometry/treatment helpers in a dedicated module**

```python
def build_fallback_air_support_mission(
    fire_cells: list[Coordinate],
    grid_size: int,
    wind_direction: str,
    random_seed: int,
) -> AirSupportMission:
    center = fire_cells[0]
    start = (center[0], max(0, center[1] - 3))
    end = (center[0], min(grid_size - 1, center[1] + 3))
    return AirSupportMission(
        id=f"air-{random_seed}",
        aircraft_model="P2V",
        payload_type=AirSupportPayload.RETARDANT,
        approach_points=[(max(0, start[0] - 4), max(0, start[1] - 4)), start],
        drop_start=start,
        drop_end=end,
        progress=0.0,
    )


def rasterize_drop_run(start: Coordinate, end: Coordinate) -> list[Coordinate]:
    return [(start[0], y) for y in range(min(start[1], end[1]), max(start[1], end[1]) + 1)]
```

- [ ] **Step 4: Extend the engine with mission handling and decay**

```python
case CommandAction.DROP_RETARDANT:
    mission = self._build_air_support_mission(command)
    self._session_state.air_support_missions.append(mission)
    treated_cells = self._apply_air_support_drop(mission)
    return [{
        "kind": "air_support_dispatched",
        "mission_id": mission.id,
        "payload_type": mission.payload_type.value,
        "cells": treated_cells,
    }]
```

- [ ] **Step 5: Run focused engine tests**

Run: `pytest tests/test_simulation_engine.py -k "air_support or treated or burnout" -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/test_simulation_engine.py src/watchtower_backend/services/simulation/air_support.py src/watchtower_backend/services/simulation/engine.py
git commit -m "feat: add air support simulation logic"
```

## Task 3: Extend Planner Inputs And Heuristic Fallback

**Files:**
- Modify: `src/watchtower_backend/services/planning/schemas.py`
- Modify: `src/watchtower_backend/services/planning/prompts.py`
- Modify: `src/watchtower_backend/services/planning/orchestrator.py`
- Test: `tests/test_planner.py`

- [ ] **Step 1: Write the failing planner tests**

```python
async def test_anthropic_planner_parses_air_support_geometry():
    class _AirSupportClient:
        class messages:
            @staticmethod
            async def create(**_: object):
                return _FakeAnthropicResponse(
                    content=[
                        _FakeTextBlock(
                            type="text",
                            text=(
                                '{"commands":[{"unit_id":"tower","action":"drop_retardant",'
                                '"target_x":8,"target_y":13,"drop_start_x":8,"drop_start_y":10,'
                                '"drop_end_x":8,"drop_end_y":16,"approach_points":[[4,10],[6,10]],'
                                '"rationale":"Seal the head fire."}]}'
                            ),
                        )
                    ]
                )

    state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    planner = AnthropicPlanner(
        model="fake-model",
        timeout_seconds=1.0,
        max_tokens=100,
        fallback_planner=HeuristicPlanner(),
        anthropic_client=_AirSupportClient(),
    )
    commands = await planner.plan(session_state=state)
    assert commands[0].action == CommandAction.DROP_RETARDANT
    assert commands[0].drop_start == (8, 10)
    assert commands[0].drop_end == (8, 16)


async def test_heuristic_planner_dispatches_air_support_when_fire_is_active():
    state = build_initial_state(
        doctrine_text="Protect the village.",
        doctrine_title="Doctrine",
        wind=WindState(direction="NE", speed_mph=10.0),
        grid_size=24,
    )
    planner = HeuristicPlanner()
    commands = await planner.plan(session_state=state)
    assert any(command.action == CommandAction.DROP_RETARDANT for command in commands)
```

- [ ] **Step 2: Run planner tests to verify they fail**

Run: `pytest tests/test_planner.py -v`
Expected: FAIL because planner schemas and heuristic fallback only know `move`, `drop_water`, `create_firebreak`, and `hold_position`.

- [ ] **Step 3: Extend planner payloads and prompts**

```python
class PlannerCommandPayload(BaseModel):
    payload_type: str | None = None
    approach_points: list[tuple[int, int]] = Field(default_factory=list)
    drop_start_x: int | None = None
    drop_start_y: int | None = None
    drop_end_x: int | None = None
    drop_end_y: int | None = None
```

- [ ] **Step 4: Add heuristic fallback mission planning**

```python
if unit.unit_type is UnitType.ORCHESTRATOR and session_state.fire_cells:
    commands.append(
        UnitCommand(
            session_id=session_state.id,
            unit_id=unit.id,
            action=CommandAction.DROP_RETARDANT,
            target=priority_fire,
            rationale="Lay retardant across the active fire front.",
            state_version=session_state.version,
        )
    )
```

- [ ] **Step 5: Re-run planner tests**

Run: `pytest tests/test_planner.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add tests/test_planner.py src/watchtower_backend/services/planning/schemas.py src/watchtower_backend/services/planning/prompts.py src/watchtower_backend/services/planning/orchestrator.py
git commit -m "feat: teach planners to dispatch air support"
```

## Task 4: Add Frontend State, Adapters, And Mock-Session Parity

**Files:**
- Create: `src/lib/air-support.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/adapt.ts`
- Modify: `src/lib/mock-fire-simulation.ts`
- Test: None dedicated; verify through focused build/lint after implementation

- [ ] **Step 1: Add failing type-level usage in the mock simulation**

```ts
const activeMission = state.airSupportMissions[0];
const treated = state.treatedCells.filter((cell) => cell.remainingTicks > 0);
```

- [ ] **Step 2: Run lint/type-aware checks to verify the new fields are missing**

Run: `npx eslint --no-warn-ignored src/lib/types.ts src/lib/adapt.ts src/lib/mock-fire-simulation.ts`
Expected: FAIL or type errors until the new state model is wired through.

- [ ] **Step 3: Add the frontend state model and shared helpers**

```ts
export type AirSupportPayload = 'water' | 'retardant';

export interface AirSupportMission {
  id: string;
  aircraftModel: AircraftModel;
  payloadType: AirSupportPayload;
  approachPoints: Coordinate[];
  dropStart: Coordinate;
  dropEnd: Coordinate;
  phase: 'approach' | 'drop' | 'complete';
  progress: number;
}
```

- [ ] **Step 4: Mirror the backend behavior in mock-session**

```ts
function decayTreatedCells(state: SessionState): TreatedCell[] {
  return state.treatedCells
    .map((cell) => ({ ...cell, remainingTicks: cell.remainingTicks - 1 }))
    .filter((cell) => cell.remainingTicks > 0);
}
```

- [ ] **Step 5: Run focused lint checks**

Run: `npx eslint --no-warn-ignored src/lib/types.ts src/lib/adapt.ts src/lib/air-support.ts src/lib/mock-fire-simulation.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/adapt.ts src/lib/air-support.ts src/lib/mock-fire-simulation.ts
git commit -m "feat: add frontend air support state"
```

## Task 5: Render Aircraft, Routes, Payload, And Treated Strips

**Files:**
- Modify: `src/components/MapCanvas.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/lib/game-palette.ts`
- Test: None dedicated; verify by lint and build

- [ ] **Step 1: Add the rendering entry points**

```ts
for (const treatedCell of state.treatedCells) {
  drawTreatedCell(ctx, treatedCell, mapX, mapY, cellW, cellH);
}

for (const mission of state.airSupportMissions) {
  drawAirSupportMission(ctx, mission, mapX, mapY, cellW, cellH, time);
}
```

- [ ] **Step 2: Run lint on the canvas/page files to catch missing symbols**

Run: `npx eslint --no-warn-ignored src/components/MapCanvas.tsx src/app/page.tsx`
Expected: FAIL until the new draw helpers and state accessors exist.

- [ ] **Step 3: Implement the pixel-art silhouettes and overlay rendering**

```ts
function drawAircraftSilhouette(
  ctx: CanvasRenderingContext2D,
  model: AircraftModel,
  x: number,
  y: number,
  scale: number,
) {
  const pixels = AIRCRAFT_SPRITES[model];
  for (const [px, py] of pixels) {
    ctx.fillRect(x + px * scale, y + py * scale, scale, scale);
  }
}
```

- [ ] **Step 4: Keep page wiring unchanged except for richer snapshot data**

```ts
if (envelope.kind === 'snapshot' && envelope.snapshot) {
  const snap = envelope.snapshot as unknown as SessionState;
  setGameState(snap);
}
```

- [ ] **Step 5: Run focused lint checks**

Run: `npx eslint --no-warn-ignored src/components/MapCanvas.tsx src/app/page.tsx src/lib/game-palette.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/MapCanvas.tsx src/app/page.tsx src/lib/game-palette.ts
git commit -m "feat: render air support overlays on the map"
```

## Task 6: End-To-End Verification

**Files:**
- Modify: None unless a verification failure reveals a bug
- Test: `tests/test_api.py`
- Test: `tests/test_planner.py`
- Test: `tests/test_simulation_engine.py`

- [ ] **Step 1: Run the backend test suite covering the changed systems**

Run: `pytest tests/test_api.py tests/test_planner.py tests/test_simulation_engine.py -v`
Expected: PASS

- [ ] **Step 2: Run focused frontend lint**

Run: `npx eslint --no-warn-ignored src/lib/types.ts src/lib/adapt.ts src/lib/air-support.ts src/lib/mock-fire-simulation.ts src/components/MapCanvas.tsx src/app/page.tsx`
Expected: PASS

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Commit the integrated feature**

```bash
git add tests/test_api.py tests/test_planner.py tests/test_simulation_engine.py src/watchtower_backend/domain/models/simulation.py src/watchtower_backend/domain/commands.py src/watchtower_backend/api/schemas/sessions.py src/watchtower_backend/services/sessions/runtime.py src/watchtower_backend/services/simulation/air_support.py src/watchtower_backend/services/simulation/engine.py src/watchtower_backend/services/planning/schemas.py src/watchtower_backend/services/planning/prompts.py src/watchtower_backend/services/planning/orchestrator.py src/lib/types.ts src/lib/adapt.ts src/lib/air-support.ts src/lib/mock-fire-simulation.ts src/components/MapCanvas.tsx src/app/page.tsx src/lib/game-palette.ts
git commit -m "feat: add transient air support retardant drops"
```
