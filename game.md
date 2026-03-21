# WATCHTOWER — Game Design Document

## Concept

A multi-agent LLM forest fire simulation. Players write a firefighting strategy, deploy an AI orchestrator agent, and watch it command a team of sub-agents (helicopters, ground crews) to contain a wildfire and protect a village. The agents reason, communicate, and adapt autonomously — no human intervention once deployed. All inter-agent communication is broadcast live as voiced radio chatter via ElevenLabs.

---

## Entry

User lands on the site. Dark screen, ambient forest sounds, faint radio static. Flat illustrated title card — Firewatch map aesthetic, dusk palette, a lone watchtower silhouette. The title: **WATCHTOWER**.

Below it: two options.
- `DEPLOY DEFAULT AGENT` — jump straight in with a pre-loaded strategy
- `WRITE YOUR DOCTRINE` — open the terminal

---

## The Terminal (Pre-Game)

A full-screen retro terminal opens. Monospace font, amber text on black, blinking cursor.

```
WATCHTOWER COMMAND SYSTEM v1.0
> ENTER FIREFIGHTING DOCTRINE

Your strategy will be injected into the orchestrator agent.
It will use this doctrine to make all in-game decisions.
The agent acts alone. You will not intervene.

DOCTRINE >
```

User types anything — real USFS wildfire protocols they've researched, aggressive strategies, conservative ones, experimental ideas. No structure enforced. The richer and more specific, the better their agent performs.

When done: `> DEPLOY`

Brief pause. Terminal prints:
```
Initialising orchestrator...
Fetching wind conditions... [London, 12mph NE]
Spawning sub-agents... [2x HELICOPTER] [3x GROUND CREW]
Fire ignition point set.
Stand by.
```

---

## The Map

The terminal dissolves. The map fades in.

Flat illustrated top-down forest — dark teal organic tree shapes packed across the grid, warm amber sky gradient behind everything. Subtle elevation variation through color tone: highlands slightly lighter, valleys deeper. A small village sits in the bottom-right corner — illustrated houses, a road, a water tower.

**Fire ignites** at a random point — a single cell glows orange-red. Wind arrows in the corner show direction and speed (pulled from OpenWeather for the location seeded at start). The fire begins spreading, slowly consuming cells, the warm glow bleeding outward.

**Agent icons appear:**
- Watchtower (centre-map): blinking amber light — the orchestrator is active
- Helicopters: small flat helicopter icons
- Ground crews: small figure icons

As the orchestrator issues its first commands, **dotted route lines appear** on the map — the planned path of each agent, like annotations on a paper map. Agents animate smoothly along these paths. When a helicopter reaches its drop zone, an animated water burst blooms across several cells — fire cells darken, cool, go out. When ground crew reaches a firebreak position, cells along their path turn cleared brown, forming a barrier line.

The map feels alive. Fire creeps. Agents respond. Routes redraw as strategy adapts.

---

## The Radio

Fixed panel on the right side — illustrated radio unit, frequency display, waveform visualiser.

The moment the orchestrator issues its first command, a voice crackles through:

> *"All units, this is Command. Fire is tracking northeast with the wind. Alpha helicopter, move to grid F7 and suppress the leading edge. Bravo helicopter, hold at the ridge — I need you ready for the flank. Ground teams, begin firebreak at the treeline south of the village. Do not let it get to that road."*

Each agent has a distinct ElevenLabs voice:
- **Orchestrator**: measured, authoritative — a commander
- **Helicopter pilots**: clipped, operational — military brevity
- **Ground crews**: gritty, slightly stressed — boots on the ground

Sub-agents radio back as they complete actions:

> *"Alpha, water drop complete. Suppression at sixty percent. Moving to secondary."*

> *"Ground Team 2, firebreak established at south treeline. Fire is close. Requesting priority support."*

Orchestrator adapts:

> *"Copy that, Ground 2. Bravo helicopter, redirect north flank — abort previous assignment. Ground Team 1, reinforce south."*

The **text transcript** scrolls in sync with audio — callsign, message, timestamp. Users who can't listen can still follow every decision. The whole exchange is also posted live to the **Luffa channel** as text, so people watching on their phones see it in real-time.

---

## Agent System

**Hierarchy:**
```
User Strategy Doc (pre-game only)
        ↓
  Orchestrator LLM  ←  game state every tick
     ↙        ↘
Helicopter    Ground Crew
 Agent(s)      Agent(s)
```

**Orchestrator** — system prompt = base firefighting logic + user's strategy doc injected on top. On each simulation tick it receives the full map state (fire positions, wind, agent positions, village status) and decides: who goes where, what action, in what priority order. It has one class of tools: `command_agent(agent_id, action, location)`.

**Sub-agents** — each is an LLM with a narrow role and constrained tools:
- Helicopter: `move_to`, `drop_water`, `report_status`
- Ground crew: `move_to`, `create_firebreak`, `report_status`

They receive orders, execute, and report back. The orchestrator adapts based on reports.

**User influence = only the strategy doc.** Written pre-game in the terminal. Once deployed, fully autonomous.

**Error recovery** — if a sub-agent fails (runs out of water, terrain blocks movement), it reports back and the orchestrator re-routes. This plays out live on the radio.

---

## The Game Loop

Every tick (every few seconds):

1. Simulation updates — fire spreads, wind shifts slightly, agent positions update
2. Orchestrator LLM receives full map state
3. Reasons about strategy, issues new commands via tool calls
4. Sub-agent LLMs receive orders, execute tools, report back
5. Inter-agent messages → ElevenLabs → audio plays → transcript updates → Luffa posts
6. Map animations reflect decisions

---

## Win / Lose

**Win**: Fire contained, village intact. Radio goes quiet. Then:

> *"All units, stand down. Village is secure. Fire contained. Good work."*

Warm animation — extinguished cells cool to dark, map settles. Score calculated: time taken, water drops used, firebreaks laid, village damage. User names their strategy (or gets an auto-generated callsign like `DOCTRINE-SIERRA-7`) and it hits the leaderboard with their doctrine snippet visible.

**Lose**: Fire reaches the village. Ground crew radios in:

> *"It's at the perimeter, we can't hold it—"*

Screen darkens. Orchestrator:

> *"All units fall back. We've lost the village."*

Debrief screen: what went wrong, where the strategy failed, fire progression replay. Prompt to rewrite doctrine and try again.

---

## The Leaderboard

Live rankings: strategy name, time to contain, resources used, doctrine snippet (first 100 chars). Others can read what worked. Competitive, replayable. Judges can deploy their own strategy on the spot during the demo.

---

## Simulation Engine

- Grid-based map
- Fire spreads via cellular automata
- Wind direction and speed pulled from OpenWeather API (seeded by location)
- Procedurally generated terrain with elevation — highlands slow ground agents and affect fire spread direction
- One protected asset: the village — defines win/lose condition

---

## Track Targets

**Primary: AI Agents**
Hierarchical multi-agent LLM system, real tool use, exposed reasoning via radio, zero human intervention post-deploy.

**Primary: LuffaNator**
Agent radio comms mirrored to a Luffa bot channel in real-time. Users join and watch the agents coordinate through Luffa's messaging platform.

**Secondary: Civic Guardrails**
Civic validates agent inputs/outputs — guards against malicious data in weather feed manipulating agent decisions.

**Also: LuffaMedia**
Post the build journey throughout the hackathon.

---

## Aesthetic

- **Visual style**: Firewatch in-game map — flat illustrated top-down forest, 2D organic tree shapes, warm amber/orange fire against deep teal forest, subtle elevation through color tone
- **Palette**: deep teal-purple forest, warm amber sky, orange-red fire, cool blue water drops
- **Animations**: agents glide along dotted route lines, fire bleeds outward cell by cell, water bursts on drop, firebreak cells turn cleared brown
- **Sound**: forest ambience, radio static crackle between transmissions, helicopter rotors, water drop impact, fire crackle
- **UI**: terminal (monospace, amber on black), radio panel (waveform visualiser, scrolling transcript), leaderboard sidebar

---

## Tech Stack

| Layer | Tech |
|---|---|
| API + WebSockets | FastAPI + uvicorn |
| Agent orchestration | LangGraph + Anthropic SDK |
| Tool interface | MCP (`langchain-mcp-adapters`) |
| Simulation loop | asyncio + numpy |
| Voice | ElevenLabs async SDK |
| Weather | httpx → OpenWeather API |
| Messaging | Luffa SDK |
| Leaderboard | SQLite + SQLAlchemy |
| Frontend comms | WebSocket (state diffs + audio chunks) |
| Frontend | Next.js + Canvas/SVG, Tailwind |

Single Python process. No Redis needed — asyncio queues handle all internal communication.

---

## Backend Architecture

### The Core Problem

Simulation ticks every ~3 seconds. LLM calls take 1-5 seconds. **The simulation cannot block waiting for agents.** These two loops must be fully decoupled.

**Solution: two async loops in one Python process, communicating via `asyncio.Queue`.**

```
Simulation Engine (MCP Server)
        ↑ exposes tools via stdio MCP server
Agent Loop (asyncio task)
        ↓ MultiServerMCPClient loads tools dynamically
        ↓ runs LangGraph with MCP tools
        ↓ pushes commands to simulation's pending_actions buffer
Simulation Loop (asyncio task, ticks every 3s)
        ↓ applies pending_actions each tick
        ↓ pushes state snapshot to agent queue
```

The simulation never waits for agents. Agent commands land in a buffer and get applied on the next tick. If agents are slow, the fire spreads without intervention that tick — which is realistic.

---

### MCP Architecture

The simulation engine runs as an **MCP server**, exposing all simulation tools. LangGraph agents connect via `langchain-mcp-adapters` and discover tools dynamically — clean separation between sim and agents, no hardcoded tool bindings.

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

async with MultiServerMCPClient({
    "simulation": {
        "command": "python",
        "args": ["simulation_mcp_server.py"],
        "transport": "stdio"
    }
}) as client:
    tools = await client.get_tools()
    # tools = [read_map, get_agent_status, move_to, drop_water,
    #          create_firebreak, report_status, command_agent]
    agent = create_react_agent(model, tools)
```

**Why MCP:** the simulation and agent system are fully decoupled at the protocol level. The sim just runs its MCP server — agents discover tools without knowing anything about the implementation. This also gives the Civic track integration for free: Civic slots in as MCP middleware, intercepting tool calls between agents and the simulation to validate inputs/outputs before they execute.

```
Agent → MCP call → [Civic middleware validates] → Simulation MCP Server
```

---

### LangGraph Design

Use the **Send API for parallel sub-agents** — the fan-out pattern LangGraph is built for.

```python
class GameState(TypedDict):
    map_state: dict          # grid, fire cells, agent positions, terrain
    wind: dict               # direction, speed from OpenWeather
    agent_states: dict       # per-agent: position, resources, status
    pending_commands: list   # queued actions to apply next tick
    message_log: list        # inter-agent comms for radio
    tick: int
    village_intact: bool
```

**Graph structure:**
```
orchestrator_node
      ↓ Send API — fans out to all active sub-agents in parallel
[helicopter_node_1, helicopter_node_2, ground_crew_node_1, ...]
      ↓ all report back — map-reduce into orchestrator
orchestrator_node (next cycle)
```

The orchestrator runs, reads map state, decides strategy, uses `Send` to dispatch commands to each sub-agent node simultaneously. Sub-agents execute tools in parallel via MCP, report back. Orchestrator aggregates reports, adapts. One full cycle = one agent decision round.

---

### MCP Tools

All tools are exposed by the simulation MCP server. Agents call them like any LangChain tool — the MCP layer handles the protocol translation.

**Orchestrator tools** (reads and commands only — never mutates simulation directly):
```python
read_map() → dict                          # current fire positions, agent positions, wind
get_agent_status(agent_id) → dict          # resources remaining, current position
command_agent(agent_id, action, coords)    # queues action in pending_commands
```

**Sub-agent tools** (simulation mutations):
```python
move_to(coords)                # updates agent position
drop_water(coords)             # suppresses fire cells in radius
create_firebreak(coords)       # clears cells along a line
report_status(message: str)    # pushes to message_log → radio queue
```

`report_status` is the radio trigger. Every call pushes a message onto the ElevenLabs queue and gets voiced.

---

### FastAPI Endpoints

```
POST /game/start          # accepts strategy doc, spawns game session
GET  /game/{id}/ws        # WebSocket — streams simulation state to frontend
POST /game/{id}/end       # score + leaderboard write
GET  /leaderboard         # top strategies
```

WebSocket broadcasts a **state diff** every tick — not the full grid, just what changed (new fire cells, agent positions, new radio message). Keeps payload lean.

---

### ElevenLabs Radio Queue

Radio messages play **sequentially** — agents cannot talk over each other. Single `asyncio.Queue` as the TTS pipeline:

```python
# Each report_status tool call pushes here
radio_queue: asyncio.Queue[RadioMessage]

# Single consumer — processes one message at a time
async def radio_consumer():
    while True:
        msg = await radio_queue.get()
        audio = await elevenlabs.generate(msg.text, voice=msg.agent_voice)
        await ws_manager.broadcast_audio(audio)
        await ws_manager.broadcast_transcript(msg)
        await luffa_bot.post(msg)
```

Each agent role has a fixed ElevenLabs voice ID assigned at game start:
- Orchestrator → voice A (authoritative)
- Helicopters → voice B (clipped, operational)
- Ground crews → voice C (gritty, stressed)

---

### Simulation Engine

Pure Python + numpy, no heavy dependencies:

```python
GRID_SIZE = 64             # 64x64 cells

terrain: np.ndarray        # elevation values, generated once at game start
fire: np.ndarray           # boolean grid — True = burning
moisture: np.ndarray       # affects fire spread rate per cell
agents: dict               # agent_id → position, type, resources remaining
```

**Fire spread per tick:**
```python
for each burning cell:
    for each neighbor:
        spread_prob = base_rate
        spread_prob *= wind_factor(wind_dir, cell_direction)
        spread_prob *= terrain_factor(elevation_delta)
        spread_prob *= (1 - moisture[neighbor])
        if random() < spread_prob:
            fire[neighbor] = True
```

Wind pulled from OpenWeather once at game start, used for the full session.

---

## Team Split (4 Devs)

| Dev | Responsibility |
|-----|---------------|
| 1 | Simulation engine — fire spread, terrain, grid, win/lose |
| 2 | Multi-agent system — LangGraph orchestrator + sub-agents, tools |
| 3 | Radio — ElevenLabs integration, voice routing, Luffa bot |
| 4 | Frontend — Firewatch map, animations, terminal UI, leaderboard |
