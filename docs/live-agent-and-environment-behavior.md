# WATCHTOWER Live Agent And Environment Behavior

This document describes the current live-backend behavior of the simulation, not just the intended design.

## Agentic And Algorithmic Behavior

On the live backend, control is split between agentic planning and deterministic simulation.

The agentic layer is responsible for deciding intent. The runtime starts a planning round immediately when a session begins, then requests new plans on a fixed interval. The planner is hierarchical:

- an orchestrator decides missions for each field unit and may also request one fixed-wing air-support mission
- a sub-agent converts each unit mission into one concrete command plus an optional radio line

The planner can be driven by Kiro, and if Kiro fails, times out, or leaves units uncommanded, the heuristic planner fills gaps. Every returned command is then checked against hard simulation rules before it is allowed through.

### Ground 1 and Ground 2

Ground 1 and Ground 2 are containment units. Their intended role is to build safe firebreaks outside the active fire edge rather than attack the core directly.

Agentically, the planner is pushed toward safe containment work:

- they are given safe ground-cell candidates near the fire edge
- they are told to preserve themselves first
- they are told not to target burning cells or routes that trap them against fire or water

Algorithmically, they are governed by terrain-aware pathfinding and survival rules:

- they use A* pathfinding rather than simple straight-line movement
- they cannot enter active fire
- they cannot enter water
- they cannot cut diagonally across blocked fire or water corners
- they prefer flatter terrain because slope adds path cost
- they are penalized for routing close to active fire
- they are also penalized for routing near water, which makes river and lake edges slower

Their movement speed is handled separately from fire spread. The fire still spreads on its own cadence; ground crews simply consume a movement budget each tick. When they reach a firebreak target, they create a short three-cell firebreak line.

If a target becomes unsafe or unreachable as the fire evolves, the engine tries to retarget them to another safe reachable containment line rather than letting them freeze. If a ground crew ever ends up inside a live fire cell, that unit is killed and marked inactive.

### Alpha and Bravo

Alpha and Bravo are helicopters and act as direct suppression units.

Agentically, they are instructed to suppress the fire edge or the cells immediately ahead of the active front, rather than wasting drops in the already-burning core whenever a better edge target exists.

Algorithmically:

- they can only move, drop water, or hold position
- a `drop_water` command does not extinguish anything immediately
- the helicopter must physically reach the assigned target first
- once it arrives, the drop is executed and water is consumed

Suppression is intensity-aware:

- embers are easiest to extinguish
- burning cells are harder
- infernos are hardest

Each helicopter starts with a fixed water supply and currently has no refill loop in the live backend.

### Planes

Fixed-wing aircraft are not normal units and are not controlled as separate sub-agents. They are dispatched directly by the tower when the orchestrator requests air support.

The orchestrator may request:

- payload type: water or retardant
- a focus area
- an optional straight drop line
- optional approach points

If the planner does not provide geometry, the simulation generates it. In either case, the engine sanitizes the run so it sits on the fire edge or just ahead of the front where possible, especially on the flank that threatens the village. If a requested run overlaps too much already-burning fire, the engine shifts it outward toward containment.

Plane missions are transient and move through three phases:

- approach
- drop
- exit

Only one live air-support mission can be active at once.

When the drop happens, the engine paints a widened straight corridor of water or retardant across the terrain. That corridor can:

- directly suppress some burning cells
- cool some burning cells without fully extinguishing them
- leave a treated strip behind that reduces future spread and increases effective moisture

Water is shorter-lived and better for direct suppression. Retardant lasts longer and is better for slowing future spread.

### Important Distinction

The agents choose intent: who should do what, where, and why.

The simulation is the final authority. It enforces:

- reachability
- survival constraints
- terrain movement costs
- fire spread
- suppression odds
- firebreak placement
- air-drop geometry

## Environment Features, Fire Spread, and Agent Interaction

The environment is a terrain grid. Each tile has elevation, vegetation, and optional water.

### Environment Features

Water tiles block fire completely. They also make nearby land wetter, which lowers spread risk. Vegetation controls how flammable a tile is, and elevation matters because fire spreads more aggressively uphill and more slowly downhill.

The map also tracks:

- active fire cells
- burned cells
- suppressed cells
- firebreak cells
- treated cells from water or retardant drops

Those treated cells matter after the drop has happened because they change how likely future spread is.

### How Wind Affects the Fire

Wind is one of the main spread multipliers.

The simulation converts wind direction into a vector, compares that vector with the direction from a burning tile to a neighboring tile, and increases spread probability when the fire is moving with the wind. Stronger wind makes that directional advantage larger.

So in practice:

- fire spreads more easily downwind
- crosswind spread is less favored
- upwind spread is least favored

### How the Fire Spreads

Every tick, each active burning tile attempts to ignite neighboring tiles.

The spread probability is influenced by:

- base spread rate
- target vegetation type
- wind direction and speed
- slope between source and target
- effective moisture on the target tile
- whether the move is diagonal
- current fire intensity
- any lingering water or retardant treatment on the target tile

Fire also has intensity stages:

- ember
- burning
- inferno

Higher-intensity cells spread more aggressively and are harder to suppress.

Fire cannot spread into water. Firebreaks also block spread. During the opening phase of the game, the sim intentionally prevents the whole incident from disappearing too early by keeping at least one hotspot alive until a minimum tick threshold has passed.

### How the Agents Interact with the Environment

The agents do not act directly on the world without restriction. They work through commands that are then filtered by environment and safety rules.

Ground crews interact with the environment by:

- pathfinding over traversable terrain
- preferring flatter, safer routes
- staying out of fire
- refusing water crossings
- building firebreak lines at safe standoff positions

Helicopters interact with it by:

- moving directly to assigned targets
- dropping water only on arrival
- suppressing active fire cells near the target

Planes interact with it by:

- flying a transient approach and exit route
- laying a straight water or retardant corridor
- changing the moisture and spread properties of the tiles they hit

So the environment is not just visual context. It directly shapes:

- where agents are allowed to go
- how quickly they can get there
- where fire can and cannot spread
- how effective suppression and retardant lines will be
