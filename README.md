# WATCHTOWER Backend Context

This document explains the current backend so another agent or teammate can quickly understand:
- how the app boots
- where the runtime logic lives
- which files own what
- where to plug in new features or fix bugs

## High-Level Summary

WATCHTOWER is a FastAPI backend for a wildfire simulation game with a hierarchical multi-agent AI system.

The backend currently provides:
- REST endpoints for sessions, leaderboard, health, and replays
- WebSocket streaming for live session updates
- a deterministic wildfire simulation engine
- a session runtime that ticks the sim and calls a planner
- persistence for leaderboard entries and replay logs
- integration seams for:
  - Anthropic planning (orchestrator + sub-agents)
  - OpenWeather wind lookup
  - ElevenLabs audio generation (per-role voices)
  - Luffa bot (interactive command interface + radio relay)

The architecture is intentionally split into:
- `api/`: HTTP + WebSocket surface
- `core/`: app setup, config, errors, logging
- `domain/`: typed models, commands, events, protocols
- `services/`: runtime logic and integrations
- `persistence/`: DB and replay storage
- `tests/`: coverage for core behavior

### Target Multi-Agent Architecture

The planner layer is evolving from a single `AnthropicPlanner` (outputs all `UnitCommand`s at once) toward a two-tier hierarchy:

```
Orchestrator (Claude Sonnet)
  → reads full game state + user doctrine
  → outputs Missions (high-level intent per unit)
  → runs every planner interval (~5s)

Sub-agents (Claude Haiku, one per unit type)
  → reads assigned Mission + local unit state
  → outputs proposed UnitCommand + radio_message
  → only called when mission changes or unit reports failure
  → runs in parallel via LangGraph Send API

Validator
  → merges proposed commands
  → rejects illegal/stale commands
  → passes to SimulationEngine.step() — single authority gate
```

This keeps the sim loop non-blocking: sub-agents only fire on mission change or failure, not every tick. Cost stays manageable (3-5 Haiku calls per orchestrator cycle, not N×ticks).

## Runtime Flow

At startup, the app:
1. Loads settings
2. Creates shared clients and services
3. Creates database tables
4. Builds a `SessionManager`
5. Starts the radio worker

When a session is created:
1. Weather is fetched via `WeatherProvider`
2. Initial `SessionState` is built
3. A `SessionRuntime` is created
4. The runtime starts ticking in the background

During a session loop:
1. Planner may generate `UnitCommand`s
2. Simulation engine applies commands
3. Fire spreads / units move / score updates
4. Events are emitted
5. WebSocket clients get snapshots/events
6. Replay log is appended
7. Radio messages may trigger TTS/Luffa work in the background

## Main Entry Points

### `src/watchtower_backend/main.py`
Owns the FastAPI app factory.

Responsibilities:
- create the app
- mount static audio under `/media/audio`
- include routers
- register exception handlers

If you want to:
- add a new router
- change middleware/app-level behavior
- expose more static assets

start here.

### `src/watchtower_backend/core/lifespan.py`
This is the composition root of the backend.

Responsibilities:
- build shared `httpx`, Anthropic, and ElevenLabs clients
- create the DB engine/session factory
- create tables
- instantiate concrete providers:
  - `OpenWeatherProvider`
  - `AnthropicPlanner`
  - `CompositeRadioService`
- create `SessionManager`
- start and stop background services cleanly

Important: if a new external integration is added, it will usually be wired here.

## Core Folder

### `src/watchtower_backend/core/config.py`
Defines `Settings`.

What it contains:
- API config
- DB path
- replay/audio directories
- planner timeouts/token limits
- weather config
- ElevenLabs config
- Luffa config

This is the file to update when adding new environment-driven behavior.

### `src/watchtower_backend/core/errors.py`
Defines app-specific exception types.

Examples:
- `SessionNotFoundError`
- `CommandValidationError`
- `PersistenceError`
- `IntegrationError`

Used so route handlers and runtimes can fail with explicit semantics.

### `src/watchtower_backend/core/logging.py`
Configures process-wide logging.

Right now it is simple, but this is where structured logging or JSON logging would go later.

## API Folder

### `src/watchtower_backend/api/dependencies.py`
Small FastAPI dependency helpers.

It exposes shared app-state services like:
- `SessionManager`

If more app-scoped services are needed in routes, add dependency helpers here.

### `src/watchtower_backend/api/routers/health.py`
Simple health endpoint.

Used for uptime / basic operational checks.

### `src/watchtower_backend/api/routers/sessions.py`
Main game session API.

Endpoints:
- create session
- list active sessions
- get one session
- terminate a session
- stream a session over WebSocket

This is the most important external API surface for the frontend.

### `src/watchtower_backend/api/routers/leaderboard.py`
Lists persisted leaderboard entries.

### `src/watchtower_backend/api/routers/replays.py`
Reads replay JSONL files and returns event history for a session.

### `src/watchtower_backend/api/schemas/sessions.py`
Pydantic request/response models for session routes.

### `src/watchtower_backend/api/schemas/leaderboard.py`
Pydantic response model for leaderboard rows.

## Domain Folder

The `domain/` folder is the typed language of the backend. It defines what the system means before worrying about HTTP, DB, or providers.

### `src/watchtower_backend/domain/models/simulation.py`
The most important domain file.

Contains:
- enums like `UnitType`, `GameStatus`, `CommandAction`
- state models like:
  - `WindState`
  - `VillageState`
  - `UnitState`
  - `Doctrine`
  - `ScoreSummary`
  - `SessionState`

`SessionState` is the authoritative in-memory state for one game session.

### `src/watchtower_backend/domain/commands.py`
Defines `UnitCommand`.

This is what planners return and what the simulation engine consumes.

Important design choice:
- planners do not mutate the sim directly
- they return commands
- the simulation engine is the authority that applies them

### `src/watchtower_backend/domain/events.py`
Defines event objects sent to:
- WebSocket subscribers
- replay persistence
- background integrations

Important models:
- `SessionEvent`
- `RadioMessage`
- `BroadcastEnvelope`

### `src/watchtower_backend/domain/protocols.py`
Defines the pluggable interfaces:
- `WeatherProvider`
- `Planner`
- `RadioSink`

This is how the runtime is decoupled from concrete integrations.

## Services Folder

This folder contains the actual behavior of the app.

### `src/watchtower_backend/services/sessions/manager.py`
Owns the registry of live game sessions.

Responsibilities:
- create new sessions
- stop sessions
- list/get sessions
- subscribe to session streams
- persist finished sessions
- forward external events into active runtimes

If you need to change session lifecycle behavior, start here.

### `src/watchtower_backend/services/sessions/runtime.py`
Owns one live session.

This is the heart of the backend.

Responsibilities:
- run the background loop
- call the planner on interval
- apply commands to the simulation engine
- emit events
- emit snapshots
- publish radio messages
- expose runtime state

Important detail:
- the runtime uses a copy of `SessionState` when calling the planner
- the simulation engine owns the authoritative state mutation

### `src/watchtower_backend/services/simulation/engine.py`
The deterministic simulation engine.

Responsibilities:
- apply validated commands
- move units
- drop water
- create firebreaks
- spread fire
- update scores
- determine win/loss

This is the source of truth for world mutation.

If something in gameplay feels wrong, this file is usually the first place to inspect.

### `src/watchtower_backend/services/planning/orchestrator.py`
Planner implementations.

Contains:
- `HeuristicPlanner`
- `AnthropicPlanner`

`HeuristicPlanner`:
- deterministic fallback planner
- keeps the game running even without API keys or when the LLM fails

`AnthropicPlanner` (current — single planner shape):
- builds a structured prompt
- requests JSON output
- validates it
- converts it into `UnitCommand`s
- falls back to heuristic planning if anything fails

**Planned: two-tier planner shape**

`OrchestratorPlanner` (Claude Sonnet):
- receives full `SessionState` + user doctrine
- outputs `list[Mission]` — high-level intent per unit, not low-level grid moves
- runs on the existing planner interval

`SubAgentPlanner` (Claude Haiku, per unit type):
- receives a single `Mission` + the unit's local state (position, resources, nearby fire/terrain)
- outputs `SubAgentResponse`: a proposed `UnitCommand` + a `radio_message` string
- called only when a unit's mission changes or a unit reports failure
- runs in parallel for all affected units (LangGraph Send API)

`Mission` shape (to be added to `domain/commands.py`):
```python
class Mission(BaseModel):
    agent_id: str
    intent: str          # "suppress" | "firebreak" | "reserve" | "reposition"
    target: tuple[int, int]
    priority: int
    reason: str          # used as seed for radio message generation
```

`SubAgentResponse` shape:
```python
class SubAgentResponse(BaseModel):
    proposed_command: UnitCommand
    radio_message: str   # e.g. "Moving to grid F7, beginning suppression approach"
```

### `src/watchtower_backend/services/planning/prompts.py`
Builds the planner prompt from `SessionState`.

Will need to be split into:
- `orchestrator_prompt(state, doctrine)` — strategic context, full map
- `subagent_prompt(unit_state, mission, local_context)` — narrow tactical context

If planning quality is poor, this file is one of the top tuning points.

### `src/watchtower_backend/services/planning/schemas.py`
Pydantic schemas for model-generated planner output.

Used to validate the Anthropic response before it becomes runtime commands.

Will expand to include `MissionBatch` and `SubAgentResponse` schemas when the two-tier planner is wired.

### `src/watchtower_backend/services/integrations/weather.py`
Weather provider implementations.

Contains:
- `StaticWeatherProvider`
- `OpenWeatherProvider`

`OpenWeatherProvider`:
- fetches wind via OpenWeather
- normalizes it into `WindState`
- falls back safely if config or network fails

### `src/watchtower_backend/services/radio/service.py`
Radio side-effect pipeline.

Contains:
- `InMemoryRadioService`
- `CompositeRadioService`

`CompositeRadioService`:
- queues radio work so the sim loop does not block
- generates ElevenLabs audio per message (voice assigned by agent role)
- sends messages to Luffa channel
- emits `radio.audio_ready` events back into the session

Important design:
- radio side effects are asynchronous and decoupled from gameplay ticks
- messages play sequentially — single consumer so agents never talk over each other
- each agent role has a fixed ElevenLabs voice ID (set in config):
  - Orchestrator → `WATCHTOWER_ELEVENLABS_COMMAND_VOICE_ID` (authoritative)
  - Helicopters → `WATCHTOWER_ELEVENLABS_HELICOPTER_VOICE_ID` (clipped, operational)
  - Ground crews → `WATCHTOWER_ELEVENLABS_GROUND_VOICE_ID` (gritty, stressed)

### Luffa Bot — Interactive Command Interface

The Luffa integration is not just a passive radio relay. It is the primary command interface for the LuffaNator track.

**SDK:** `luffa-bot-python-sdk` (PyPI: `pip install luffa-bot-python-sdk`) — fully async, httpx-based, drops straight into FastAPI/asyncio. Source: https://github.com/sabma-labs/luffa-bot-python-sdk

**Key models:**

```python
# Incoming
IncomingMessage:  atList, text, urlLink, msgId, uid
IncomingEnvelope: uid, count, messages, type  # type 0=DM, 1=group

# Outgoing
GroupMessagePayload: text, atList, confirm, button, dismissType
SimpleButton:        name, selector, isHidden
ConfirmButton:       name, selector, type ("default"|"destructive"), isHidden
AtMention:           name, did, length, location, userType
```

**Button selectors return as plain text messages** — when a user taps a button with `selector="deploy_yes"`, the bot receives `msg.text == "deploy_yes"`. This is how the `/deploy` confirm flow is handled.

**Polling runner built-in** — `luffa_bot.polling.run()` handles deduplication (FIFO-capped deque), concurrency via semaphore, middleware pipeline, and error hooks. No need to build any of that manually.

**What the Luffa bot does:**

Users interact with the bot directly in a Luffa channel — no website required to participate:

```
/deploy [doctrine]   — submit strategy doc, start a game session
/status              — bot queries live game state, replies in plain English
/agents              — current unit positions and assignments
/fire                — fire front progress, estimated time to village
/leaderboard         — top strategies this session
```

**`/deploy` flow with confirm buttons:**

```python
from luffa_bot.models import GroupMessagePayload, ConfirmButton

# Bot receives /deploy command → replies with confirm buttons
payload = GroupMessagePayload(
    text=f"Deploy this doctrine?\n\n\"{doctrine[:120]}...\"",
    confirm=[
        ConfirmButton(name="Deploy", selector="deploy_yes", type="default"),
        ConfirmButton(name="Cancel", selector="deploy_no",  type="destructive"),
    ]
)
await client.send_to_group(env.uid, payload, message_type=2)

# User taps Deploy → bot receives msg.text == "deploy_yes" → calls session_manager.create_session()
```

**Automatic event announcements (no command needed):**
- fire jumps a firebreak → bot posts alert to channel
- unit runs out of water/fuel → bot posts
- village under immediate threat → bot posts urgently
- win/lose → bot posts result with score and doctrine snippet

**Radio relay in Luffa:**

Every `radio_message` from a sub-agent or orchestrator is posted to the Luffa channel with callsign formatting:

```
🚁 ALPHA-1: Water drop complete at grid F7. Fire suppressed 60%. Moving to secondary.
🌲 GROUND-2: Firebreak established south treeline. Fire is close. Requesting support.
📡 COMMAND: Copy Ground-2. Bravo redirect north flank immediately. Ground-1 reinforce south.
```

This makes the Luffa channel a live mission log. People on their phones see the same drama playing out in text that the frontend shows in audio and visuals.

**Python integration shape:**

```python
# New file: services/integrations/luffa.py
from luffa_bot.client import AsyncLuffaClient
from luffa_bot.models import GroupMessagePayload, ConfirmButton, SimpleButton
from luffa_bot.polling import run as polling_run

class LuffaBot:
    def __init__(self, secret: str, group_uid: str):
        self.client = AsyncLuffaClient(secret)
        self.group_uid = group_uid

    async def start_polling(self, session_manager: SessionManager):
        """asyncio task — wraps polling_run() with command handler"""
        await polling_run(
            self.client,
            handler=self._make_handler(session_manager),
            interval=1.0,
            concurrency=3,
            dedupe=True,
        )

    async def send_group(self, text: str):
        """posts plain text to the configured group channel"""
        await self.client.send_to_group(self.group_uid, text, message_type=1)

    async def send_group_buttons(self, text: str, buttons: list[ConfirmButton]):
        """posts interactive confirm button message to the group"""
        payload = GroupMessagePayload(text=text, confirm=buttons)
        await self.client.send_to_group(self.group_uid, payload, message_type=2)

    async def on_radio_message(self, msg: RadioMessage):
        """called by CompositeRadioService — formats callsign and posts to group"""
        prefix = {"command": "📡 COMMAND", "helicopter": "🚁", "ground": "🌲"}.get(msg.role, "📻")
        await self.send_group(f"{prefix} {msg.callsign}: {msg.text}")

    async def on_session_event(self, event: SessionEvent):
        """called for major events (village threatened, win/lose) — posts alerts"""
        ...
```

Wired in `core/lifespan.py` alongside the existing `CompositeRadioService`. The bot's polling task is started as an `asyncio.create_task()` in lifespan and cancelled cleanly on shutdown. No separate httpx client needed — `AsyncLuffaClient` manages its own connection pool.

**Why this hits LuffaNator criteria:**
- agentic automation — bot autonomously manages the full game session from doctrine to result
- coordinates users — multiple players in one channel, strategies competing on leaderboard
- interacts with external systems — calls Watchtower backend, OpenWeather, simulation state
- not a chatbot — it is orchestrating a real multi-agent system on behalf of the user

### `src/watchtower_backend/services/projections/websocket.py`
Maintains per-session subscriber queues.

Responsibilities:
- fan out session events
- fan out snapshots
- drop stale subscribers if their queues fill up

This is the transport projection layer for realtime clients.

## Persistence Folder

### `src/watchtower_backend/persistence/db.py`
Async SQLAlchemy setup.

Contains:
- base class
- engine creation
- session factory
- session dependency helper

### `src/watchtower_backend/persistence/models.py`
SQLAlchemy ORM models.

Contains:
- `LeaderboardEntryModel`
- `ReplayIndexModel`

### `src/watchtower_backend/persistence/repositories/leaderboard.py`
Repository layer for:
- writing leaderboard rows
- listing leaderboard rows
- writing replay index metadata

### `src/watchtower_backend/persistence/replay_store.py`
Stores replay events as JSONL files.

This is append-only replay persistence separate from the SQL database.

## Tests

### `tests/test_api.py`
Covers:
- session lifecycle
- replay endpoint
- leaderboard persistence

### `tests/test_simulation_engine.py`
Covers:
- suppression behavior
- firebreak creation

### `tests/test_integrations.py`
Covers:
- OpenWeather mapping
- OpenWeather fallback behavior

### `tests/test_planner.py`
Covers:
- Anthropic planner structured parsing
- fallback planner path

## Important Current Behavior

### Planner behavior
- If Anthropic is not configured or fails, the app still works via `HeuristicPlanner`.

### Weather behavior
- If OpenWeather is not configured or fails, the app still works with fallback wind.

### Radio behavior
- If ElevenLabs or Luffa is not configured, transcript events still exist and gameplay still runs.
- Audio and external relay are optional side effects.

### Persistence behavior
- Replay events are written to files.
- Leaderboard and replay index metadata are written to SQLite.

## Environment Variables You’ll Care About

Common ones:
- `WATCHTOWER_DATABASE_URL`
- `WATCHTOWER_REPLAY_DIRECTORY`
- `WATCHTOWER_AUDIO_DIRECTORY`
- `WATCHTOWER_DEFAULT_TICK_INTERVAL_SECONDS`
- `WATCHTOWER_DEFAULT_PLANNER_INTERVAL_SECONDS`

Planner:
- `ANTHROPIC_API_KEY` or `WATCHTOWER_ANTHROPIC_API_KEY`
- `WATCHTOWER_PLANNER_MODEL`
- `WATCHTOWER_PLANNER_TIMEOUT_SECONDS`
- `WATCHTOWER_PLANNER_MAX_TOKENS`

Weather:
- `WATCHTOWER_OPENWEATHER_API_KEY`
- `WATCHTOWER_OPENWEATHER_LATITUDE`
- `WATCHTOWER_OPENWEATHER_LONGITUDE`

Radio:
- `ELEVENLABS_API_KEY` or `WATCHTOWER_ELEVENLABS_API_KEY`
- `WATCHTOWER_ELEVENLABS_COMMAND_VOICE_ID`
- `WATCHTOWER_ELEVENLABS_HELICOPTER_VOICE_ID`
- `WATCHTOWER_ELEVENLABS_GROUND_VOICE_ID`
- `WATCHTOWER_LUFFA_ROBOT_KEY`
- `WATCHTOWER_LUFFA_GROUP_UID`

## Where To Start Depending On The Task

If you want to...

### add a new API endpoint
Start in:
- `api/routers/`
- maybe add schemas in `api/schemas/`

### change world behavior
Start in:
- `services/simulation/engine.py`
- `domain/models/simulation.py`

### improve planning quality
Start in:
- `services/planning/prompts.py`
- `services/planning/orchestrator.py`
- `services/planning/schemas.py`

### debug why a session is weird
Start in:
- `services/sessions/runtime.py`
- `services/sessions/manager.py`
- replay output from `persistence/replay_store.py`

### wire a new external provider
Start in:
- `domain/protocols.py`
- `services/integrations/`
- `core/lifespan.py`

### evolve single planner → orchestrator + sub-agents
Start in:
- `domain/commands.py` — add `Mission` and `SubAgentResponse` models
- `services/planning/orchestrator.py` — split `AnthropicPlanner` into `OrchestratorPlanner` + `SubAgentPlanner`
- `services/planning/prompts.py` — split prompt builders for each tier
- `services/planning/schemas.py` — add `MissionBatch` and `SubAgentResponse` schemas
- `services/sessions/runtime.py` — update planner call to run orchestrator then parallel sub-agents

### make Luffa bot interactive
Start in:
- `services/integrations/luffa.py` (or equivalent) — add command handling for `/deploy`, `/status`, `/agents`, `/fire`, `/leaderboard`
- `services/sessions/manager.py` — expose state query methods the bot needs
- `core/lifespan.py` — wire Luffa bot as a listener to session events for automatic announcements

### debug why frontend realtime updates are wrong
Start in:
- `services/projections/websocket.py`
- `services/sessions/runtime.py`
- `api/routers/sessions.py`

## Architectural Rules of Thumb

- `SessionRuntime` orchestrates; `SimulationEngine` mutates.
- Planners produce commands, not direct world changes.
- Domain models are the source of truth for shapes and meaning.
- External APIs should be wrapped behind provider/service classes.
- Background side effects should not block simulation ticks.
- Replay/event output is a first-class debugging tool.

## Key File References

App boot and wiring:

```22:91:src/watchtower_backend/core/lifespan.py
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    ...
    app.state.session_manager = SessionManager(
        settings=settings,
        session_factory=session_factory,
        weather_provider=OpenWeatherProvider(
            settings=settings,
            http_client=http_client,
        ),
        planner=AnthropicPlanner(
            model=settings.planner_model,
            timeout_seconds=settings.planner_timeout_seconds,
            max_tokens=settings.planner_max_tokens,
            fallback_planner=fallback_planner,
            anthropic_client=anthropic_client,
        ),
        radio_sink=radio_service,
    )


session loop:

(runtime.py)

async def _run(self) -> None:
    ...
    if (now - last_plan_at).total_seconds() >= self._planner_interval_seconds:
        commands = await self._planner.plan(
            session_state=self._session_state.model_copy(deep=True)
        )
    ...
    mutations = self._engine.step(commands=commands)

simulation authority:

engine.py

def step(self, commands: list[UnitCommand]) -> list[dict[str, object]]:
    if self._session_state.status not in {GameStatus.PENDING, GameStatus.RUNNING}:
        return []
    ...
    for command in commands:
        mutation_records.extend(self._apply_command(command=command))
    new_fire_cells = self._spread_fire()

## Current Limitations

- planner prompt/JSON contract is still relatively simple — single `AnthropicPlanner` outputs all `UnitCommand`s at once
- sub-agents are not yet independent LLM agents — next step is splitting into `OrchestratorPlanner` (Sonnet) + `SubAgentPlanner` (Haiku) with `Mission` objects as the intermediate layer
- Luffa integration is currently a passive relay — needs to become an interactive bot handling `/deploy`, `/status`, event announcements
- replay analysis/debriefing is still basic
- no auth / multi-tenant concerns yet
- no migration system yet; tables are created directly on startup
- no production deployment docs yet
Short Version For Another Agent
If you only read five files, read these in order:

core/lifespan.py
services/sessions/runtime.py
services/simulation/engine.py
services/planning/orchestrator.py
domain/models/simulation.py

Short Version For Another Agent
If you only read five files, read these in order:

core/lifespan.py
services/sessions/runtime.py
services/simulation/engine.py
services/planning/orchestrator.py
domain/models/simulation.py
That is enough to understand most of the backend.