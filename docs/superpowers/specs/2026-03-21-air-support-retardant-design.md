# WATCHTOWER Air Support And Retardant Design

## Summary

Add transient airtanker support to WATCHTOWER so the simulation can dispatch fixed-wing retardant or water drops without turning those aircraft into permanent map units. Each air-support mission should show a pixel-art aircraft silhouette, an approach path, a straight release run, a visible falling payload, and a persistent treated strip on the terrain that slows fire spread for a long time before gradually fading.

This feature should preserve the current frontend look and the existing helicopter and ground-crew systems. It extends the simulation with a new temporary mission layer rather than replacing the current unit model.

## Goals

- Make the wildfire simulation feel more like a real aerial firefighting operation.
- Add fixed-wing air-support missions that agents can call when fighting the fire.
- Preserve the current WATCHTOWER map and frontend style while adding richer tactical behavior.
- Ensure treated terrain materially reduces fire spread without becoming a permanent hard barrier.
- Keep backend simulation and frontend fallback behavior aligned.

## Audience And Context

- Primary audience: hackathon judges, demo viewers, and teammates using the current WATCHTOWER build.
- Primary usage mode: live simulation viewing with autonomous agents issuing commands.
- Secondary usage mode: local frontend fallback when the backend is unavailable.
- Tone: tactical, austere, watchtower-era cartographic interface with restrained pixel-art overlays.

## In Scope

- Randomly choosing one visual aircraft model per air-support mission from:
  - `P2V`
  - `HC-130H`
  - `BAe-146`
  - `MD-87`
  - `C-130Q`
  - `RJ85`
  - `C-130 H & J`
- Small procedural pixel-art silhouettes for each aircraft model.
- Rendering transient aircraft missions on the map with:
  - approach route
  - straight drop run
  - moving aircraft icon
  - visible falling water or pink retardant
  - treated-tile overlay after the drop
- Backend support for planner-defined aircraft missions.
- Fallback auto-generated drop runs when agents do not provide route geometry.
- Long-lived but non-permanent treated-tile effects.
- Fire-spread logic updates so treated tiles are harder to ignite.
- Matching frontend fallback simulation behavior for `mock-session`.
- Tests for mission creation, treated-tile behavior, spread reduction, and decay timing.

## Out Of Scope

- Real differences in aircraft stats, capacity, or speed between named models.
- Permanent plane units in the same sense as helicopters or ground crews.
- Manual player targeting UI for aircraft missions.
- Refueling, cooldowns, tanker base logistics, runway simulation, or sortie counts.
- New map screens, menus, or doctrine-authoring changes.
- Replacing helicopters as the existing short-range suppression tool.

## Approved Product Decisions

- Aircraft models are visual variants only.
- Planes appear only when assigned a drop mission, then disappear.
- Agent planners may choose mission geometry when available.
- If no agent-specified geometry is available, the game generates a sensible drop line automatically.
- Air-support missions remain available whenever the planner wants to use them.
- Treated strips last a long time, but not permanently.

## Experience Flow

### 1. Mission Creation

The simulation decides to dispatch an air-support drop. The mission does not create a persistent unit in the normal unit roster. Instead, it creates a temporary mission record that contains the aircraft model, payload type, route geometry, and mission timing.

If an agent planner supplies an approach path and release line, that geometry is used directly after validation. If the planner does not supply usable geometry, the simulation derives a straight drop run from the active fire front and local wind context.

### 2. Aircraft Entry

The map shows the selected aircraft entering along the approach route. The icon should read clearly at the current map scale but remain consistent with the cartographic pixel-art language already used for map decorations.

### 3. Drop Run

When the aircraft reaches the release line, it follows a straight run between the start and end coordinates. During that run:

- the map shows the aircraft progressing along the line
- the release corridor is legible
- the payload appears visibly below the aircraft
- water appears blue-white
- retardant appears pink

The payload should read as a thin band or animated streak rather than a realistic particle simulation.

### 4. Ground Effect

Tiles under the release line become treated. The map shows a lingering overlay strip after impact. This treated strip should remain visible long enough to communicate tactical intent and should decay gradually over many ticks rather than disappearing quickly.

### 5. Fire Interaction

Treated cells are not immune to fire. Instead they become meaningfully more resistant by:

- raising effective moisture
- reducing spread probability into that tile
- slightly weakening active fire that is hit directly by the drop

Retardant should last longer and have a stronger residual effect than plain water.

## Current Codebase Constraints

The current codebase has several relevant structural boundaries:

- frontend units are modeled in `src/lib/types.ts` and currently support only helicopters and ground crews
- sparse cell state rendering lives in `src/components/MapCanvas.tsx`
- backend simulation state is authored in `src/watchtower_backend/domain/models/simulation.py`
- fire spread logic lives in `src/watchtower_backend/services/simulation/engine.py`
- planner commands currently carry a single target point through `src/watchtower_backend/domain/commands.py`
- frontend fallback fire behavior lives in `src/lib/mock-fire-simulation.ts`

This feature should add a separate mission/effect layer instead of overloading the existing permanent unit model.

## Architecture

### Mission Layer

Add a new transient `air_support_missions` layer to simulation state. Each mission should capture:

- unique mission id
- aircraft model name
- payload type (`water` or `retardant`)
- approach route points
- straight drop-run start and end
- current mission phase
- progress through the route
- drop animation lifetime

This mission layer is separate from `units` and should not interfere with helicopter or ground-crew rendering.

### Treated Terrain Layer

Add a treated-tile record keyed by coordinate. Each treated tile should store enough data to drive both simulation and rendering:

- treatment type (`water` or `retardant`)
- strength
- remaining duration in ticks

The simulation should decay this data over time, and the map should tint the tile based on the current treatment state.

### Planner Command Extension

Extend planner commands to support an air-support action that can describe:

- payload type
- optional approach points
- drop-run start
- drop-run end

If the planner omits route geometry or supplies invalid geometry, the simulation should fall back to auto-generation rather than failing the whole tick.

## Data Model Direction

### Backend Domain

The backend should add:

- an `AirSupportPayload` enum for `water` and `retardant`
- an `AirSupportPhase` enum for route progression
- a mission model for active transient aircraft missions
- a treated-cell model for residual ground effect
- a new command action for fixed-wing drops

### Frontend Types

The frontend should add parallel types for:

- air-support missions
- aircraft model identifiers
- payload types
- treated tile overlays

The adapter layer should convert backend snapshots into these frontend shapes. The mock-session path should create and advance the same shapes locally.

## Route Generation Rules

### Agent-Specified Geometry

When agents provide geometry:

- accept an arbitrary approach route
- require the drop run itself to be straight
- clamp all coordinates to the map bounds
- reject obviously broken geometry and use fallback generation instead

### Fallback Geometry

When the planner does not provide a usable route:

- locate a priority fire edge or nearest fire cluster
- derive a straight release line that crosses or shields that front
- orient the line sensibly relative to fire shape and wind
- prepend a short entry route so the aircraft visibly approaches before the run

Fallback generation should be deterministic enough to keep replays and mock-session behavior legible.

## Fire Logic

### Spread Resistance

The fire engine should incorporate treated-tile modifiers when calculating spread probability:

- water-treated cells get a strong short-term moisture boost
- retardant-treated cells get a slightly weaker immediate cooling effect but a stronger long-term spread reduction

The exact numeric tuning can be chosen during implementation, but the resulting behavior should be visibly meaningful without creating a guaranteed fireproof wall.

### Direct Hit Behavior

If an air-support drop intersects active fire:

- some active cells may be suppressed immediately
- the remaining active cells in the strip should burn at lower intensity or with reduced fuel pressure

This should complement, not replace, the existing helicopter suppression mechanic.

### Decay

Treated tiles should decay slowly over many ticks. The duration should feel long-lived in play but eventually clear so the map does not become permanently striped.

## Rendering Direction

### Aircraft Icons

Each approved aircraft model should get a distinct but minimal silhouette. Differences should be readable mainly through:

- fuselage length
- tail shape
- wing placement
- engine pod hints

Avoid excessive detail. These should feel like map symbols, not large illustrated sprites.

### Route Rendering

Render:

- a subdued approach path
- a more prominent straight release line
- a moving aircraft icon

These overlays should remain visually subordinate to fire, village, and terrain readability.

### Payload Rendering

During the release run, draw a narrow falling band between aircraft and ground using:

- cool pale blue for water
- dusty pink for retardant

The payload effect should animate over a short mission window and then yield to the lingering treated-tile strip.

### Treated Tiles

After the drop:

- water-treated cells should tint toward damp blue-grey
- retardant-treated cells should tint toward restrained pink-red

The tint should harmonize with the existing dusk palette and avoid looking neon or toy-like.

## Interaction With Existing Systems

- Existing helicopter and ground-crew commands should continue to function unchanged.
- Existing map zoom, pan, hover, and selection behavior should remain unchanged.
- Current landing page, doctrine UI, radio panel, and overall frontend styling should not be modified by this feature.
- The existing backend session loop and frontend snapshot adaptation should remain the main state flow.

## Error Handling And Edge Cases

- If the planner issues an invalid route, auto-generate a fallback mission rather than discarding air support completely.
- If a generated drop line intersects water or out-of-bounds terrain, clip it safely to valid map cells.
- If multiple treated effects hit the same cell, merge them predictably rather than stacking without limit.
- If backend air-support data is unavailable, the frontend fallback path should still show the new behavior locally.
- If there is no meaningful fire target, do not spawn a cosmetic plane just for show.

## Testing Expectations

The implementation plan should cover:

- backend command validation for air-support missions
- fallback route generation behavior
- treated-cell creation and decay
- spread-probability reduction for treated cells
- direct-hit suppression or weakening behavior
- snapshot and adapter support for mission state
- mock-session parity for mission animation and treated tiles
- map rendering of aircraft, route, drop effect, and treated strip
- non-regression for existing helicopter, ground crew, and village rendering

## Planning Constraints

- Do not rewrite the whole unit system just to add aircraft visuals.
- Keep the mission layer separate and additive.
- Favor deterministic, readable behavior over physically realistic simulation.
- Reuse the existing sparse-state and canvas-rendering patterns where possible.
- Preserve the current frontend exactly outside the new mission overlays and treated-strip visuals.

## Open Questions

None for this phase. The approved direction is:

- transient aircraft missions rather than permanent units
- aircraft models used only for visual variation
- random model selection per mission
- planner-defined geometry when agents exist
- auto-generated geometry as fallback
- long-lived but non-permanent residual effect
- unrestricted planner access to air-support missions
