# WATCHTOWER — Project Context

## What Is This

A hackathon project for **Encode Club AI London 2026** (48-hour weekend hack, happening RIGHT NOW March 21-22 2026). Competing in the **AI Agents** track. Team of 4 UCL CS students.

**Pitch:** A multi-agent LLM forest fire simulation. Players write a firefighting strategy ("doctrine"), deploy an AI orchestrator agent, and watch it command a team of sub-agents (helicopters, ground crews) to contain a wildfire and protect a village. All inter-agent communication is broadcast live as voiced radio chatter via ElevenLabs.

**Inspiration:** Firewatch (game) — the lone watchtower, top-down map aesthetic, emergency radio comms.

---

## Team Split

| Dev | Responsibility | Repo |
|-----|---------------|------|
| Joshua (you) | **Frontend** — Map, animations, terminal UI, radio panel, leaderboard | `~/Desktop/watchtower/` |
| 2 teammates | **Backend** — Simulation engine, LangGraph agents, radio/TTS, FastAPI | `github.com/Alt5r/EncodeHack2026` |
| 4th teammate | TBD | — |

---

## Judging Criteria (AI Agents track)

- **Autonomy:** Does the agent act on its own without hand-holding?
- **Usefulness:** Would someone actually use this?
- **Technical depth:** Tool use, memory, error recovery, multi-step reasoning
- **Creativity:** Novel/interesting use case

**Submission:** 3-min demo video + pitch deck + public GitHub repo

---

## Architecture Overview

### Frontend (this repo)
- **Framework:** Next.js 16 + React 19 + TypeScript + Tailwind 4
- **3D:** Three.js + @react-three/fiber + @react-three/drei
- **Terrain:** simplex-noise (procedural generation)
- **Rendering:** HTML5 Canvas 2D for the map

### Backend (separate repo: Alt5r/EncodeHack2026)
- **API:** FastAPI + uvicorn
- **Agent orchestration:** Anthropic SDK (Claude) + heuristic fallback planner
- **Simulation:** Pure Python + numpy, 64x64 grid, cellular automata fire spread
- **Voice:** ElevenLabs async SDK (TTS for radio chatter)
- **Weather:** OpenWeather API for wind conditions
- **Messaging:** Luffa SDK (real-time comms relay)
- **Persistence:** SQLite + SQLAlchemy (leaderboard, replays)
- **Comms:** WebSocket (state snapshots + events streamed to frontend)

### Integration Status
- Backend is **still in development** — not ready to integrate yet
- Frontend is being built independently for now, will connect via WebSocket later

---

## Backend Data Model (for future integration)

### WebSocket Messages
The backend sends `BroadcastEnvelope` objects:
```typescript
type BroadcastEnvelope = {
  kind: "event" | "snapshot";
  event?: SessionEvent;    // typed game events
  snapshot?: SessionState;  // full state dump
};
```

### Session State (what the backend tracks)
```typescript
type SessionState = {
  id: string;
  status: "pending" | "running" | "won" | "lost" | "terminated";
  tick: number;
  grid_size: number;        // default 64
  doctrine: { title: string; text: string };
  wind: { direction: string; speed_mph: number };
  village: { top_left: [number, number]; size: number; is_intact: boolean };
  units: UnitState[];       // orchestrator + helicopters + ground crews
  fire_cells: [number, number][];
  burned_cells: [number, number][];
  suppressed_cells: [number, number][];
  firebreak_cells: [number, number][];
  score: ScoreSummary;
  winner: string | null;
  version: number;
};
```

### Unit Types
- `orchestrator` — Watchtower (center of map, doesn't move)
- `helicopter` — Alpha & Bravo (start top-left, have water capacity)
- `ground_crew` — Ground 1 & 2 (near village, create firebreaks)

### Event Types
- `session.started`, `session.completed`
- `simulation.fire_spread`, `simulation.water_drop`, `simulation.firebreak_created`
- `simulation.unit_moved`, `simulation.unit_holding`
- `radio.message`, `radio.audio_ready`
- `command.rejected`

### API Endpoints
```
POST /api/v1/sessions              # create game (accepts doctrine_text)
GET  /api/v1/sessions              # list active sessions
GET  /api/v1/sessions/{id}         # get session detail
POST /api/v1/sessions/{id}/terminate
WS   /api/v1/sessions/{id}/ws     # real-time state stream
GET  /api/v1/leaderboard
GET  /api/v1/replays
```

---

## Frontend Screens (from game.md spec)

### 1. Entry Screen
Dark screen, ambient forest sounds, radio static. Title card: WATCHTOWER.
Two buttons: `DEPLOY DEFAULT AGENT` / `WRITE YOUR DOCTRINE`

### 2. Terminal (Pre-Game)
Full-screen retro terminal. Amber text on black, monospace, blinking cursor.
User types their firefighting strategy. `> DEPLOY` starts the game.

### 3. The Map (Main Game)
Top-down view styled after the Firewatch in-game map.
- **Terrain:** Topo contour lines on parchment (current approach)
- **Vegetation:** Three-tone fill — dark forest, light clearings, bare ground
- **Fire:** Orange-red cells spreading outward
- **Agents:** Icons with dotted route lines showing planned paths
- **Village:** Small cluster in bottom-right corner
- **Wind:** Direction arrows in corner

### 4. Radio Panel (Right Side)
Illustrated radio unit, waveform visualiser, scrolling transcript.
Agent voices play sequentially (no overlapping).

### 5. Win/Lose/Leaderboard
Score screen with time, resources used, village damage.
Leaderboard shows top strategies with doctrine snippets.

---

## Map Visual Reference

Reference image: `tumblr_o365zaIQLp1sikueao3_1280.jpg` (Firewatch "Two Forks" map)

**Three main terrain colors:**
1. **Dark olive-teal** (#3d5a3a ish) — dense forest
2. **Lighter sage/khaki green** (#7a8c5a ish) — meadows/clearings
3. **Parchment cream** (#d4c5a0) — bare/open terrain (base paper)

**Other visual elements:**
- Brown contour lines for elevation
- Blue for water features (lakes, rivers)
- Red text for location names
- Compass rose, USFS shield, map legend
- Vintage paper texture with noise grain and edge vignette

---

## Current Frontend State

### What's built:
- `page.tsx` — Full-screen container with MapCanvas + RadioViewer
- `MapCanvas.tsx` — Canvas 2D renderer: parchment base, noise grain, vignette, contour lines
- `RadioViewer.tsx` — 3D walkie-talkie model with drag-to-rotate + spring physics
- `terrain.ts` — Simplex noise heightmap generation + marching squares contour extraction

### What's needed:
- [ ] Three-tone vegetation fill on the map (forest/clearing/bare)
- [ ] Fire cell rendering (orange-red overlay)
- [ ] Agent icons and route lines
- [ ] Village rendering
- [ ] Wind indicator
- [ ] Terminal UI screen (doctrine entry)
- [ ] Entry/title screen
- [ ] Radio panel (transcript + waveform)
- [ ] WebSocket integration (when backend is ready)
- [ ] Leaderboard screen
- [ ] Win/lose screens

---

## Key Decisions Made

- **Map aesthetic:** Keep topo/contour style (not switching to flat illustrated)
- **Terrain data source:** Backend will drive terrain data (frontend terrain is cosmetic for now)
- **Grid alignment:** TBD — need to decide between matching backend 64x64 or high-res visuals with game grid overlay
- **Mock data:** Building frontend visuals first without mock simulation data
- **Integration:** Will connect to backend WebSocket later when it's ready
