# WATCHTOWER Landing Page Design

## Summary

Create a stage-first landing page for WATCHTOWER that functions as an immersive entry experience rather than a conventional marketing site. The page should open on a cinematic hero scene, then transition into a full-screen doctrine terminal experience. The terminal ends on a dramatic boot-sequence hold state at `Stand by.` rather than continuing into the full simulation.

This spec covers only the landing page experience. It does not include the live map, radio panel, leaderboard, or real multi-agent gameplay.

## Goals

- Deliver a strong live-demo opening that immediately communicates mood and premise.
- Make the user choose between a default deployment path and a custom doctrine path.
- Preserve the fiction that the user is operating a command system inside the WATCHTOWER world.
- Keep the implementation focused enough for a single frontend plan and initial build.

## Audience And Context

- Primary audience: hackathon judges and live-demo viewers.
- Primary usage mode: desktop-first stage presentation.
- Secondary usage mode: individual browsing on laptops and phones.
- Tone: cinematic, sparse, tactical, severe.

## In Scope

- A hero scene with the WATCHTOWER title, ambient atmosphere, and two primary actions.
- A full-screen terminal takeover for writing doctrine.
- A direct boot-sequence path for `DEPLOY DEFAULT AGENT`.
- A typed-doctrine path for `WRITE YOUR DOCTRINE`.
- A locked deployment sequence that prints boot lines progressively.
- A final standby hold state after deployment text completes.
- Lightweight ambient audio controls that respect browser autoplay limits.
- Responsive behavior for mobile and desktop.

## Out Of Scope

- Real map simulation.
- Real radio transcript playback.
- Live weather integration.
- Luffa, ElevenLabs, LangGraph, or backend orchestration.
- Leaderboard, scoring, replay, or debrief flows.
- Routing into a separate game screen after `Stand by.`

## Experience Flow

### 1. Idle Hero

The initial page shows a dark, illustrated dusk scene with a lone watchtower silhouette, subtle haze, and minimal copy. The title is the focal point. The only dominant interactive elements are:

- `DEPLOY DEFAULT AGENT`
- `WRITE YOUR DOCTRINE`

The hero should feel like a title card for an interactive fiction or tactical simulation, not a product homepage.

### 2. Terminal Opening

Selecting `WRITE YOUR DOCTRINE` transitions into a full-screen terminal takeover. The terminal occupies the full viewport, but the original illustrated scene remains faintly visible behind a dark smoked-glass layer. The transition should feel like moving deeper into the same world, not navigating to a new page.

### 3. Terminal Editing

The terminal presents:

- a WATCHTOWER system header
- short instructional copy
- a large freeform doctrine input region
- a deploy action

The user can type any doctrine text without validation or structure enforcement.

### 4. Deploying

Once deployment starts, the interface becomes read-only and prints the boot sequence progressively. This applies to both entry paths:

- `DEPLOY DEFAULT AGENT` skips editing and starts deployment immediately
- `WRITE YOUR DOCTRINE` starts deployment after the user triggers deploy from the terminal

Required boot copy:

```text
Initialising orchestrator...
Fetching wind conditions... [London, 12mph NE]
Spawning sub-agents... [2x HELICOPTER] [3x GROUND CREW]
Fire ignition point set.
Stand by.
```

Minor formatting polish is allowed, but the sequence and tone should remain intact.

### 5. Standby Hold

After the final line prints, the experience stops on `Stand by.` and remains in a held state suitable for a live demo. The cursor should still feel alive. No automatic transition into the map or another route occurs in this phase.

## Interaction Rules

- `WRITE YOUR DOCTRINE` opens the full-screen terminal.
- The terminal must offer both `ESC` support and a visible close control before deployment begins.
- Closing the terminal before deployment returns the user to the hero without reloading the page.
- Any typed doctrine text should remain preserved if the user closes and reopens the terminal during the same session.
- `DEPLOY DEFAULT AGENT` must bypass editing and jump directly into the boot sequence.
- Once deployment begins, close controls are disabled until the sequence completes.

## Visual Direction

The page should follow the WATCHTOWER art direction from the design document:

- flat illustrated environment
- deep teal-black forest masses
- warm amber dusk glow
- a lone watchtower silhouette as the visual anchor
- restrained orange/amber highlights for system states

The design should avoid generic startup or game-launcher UI tropes. It should feel like a field manual, command console, or surveillance interface with cinematic restraint.

## Typography

Use two visual voices:

- a narrow, cinematic display face for the title and major labels
- a hard monospace face for terminal UI, metadata, and system text

CTAs should read as command decisions rather than rounded marketing buttons.

## Motion

Motion should be sparse and purposeful:

- slow atmospheric haze or smoke in the hero
- faint beacon or radio-like pulses
- a deliberate hero-to-terminal takeover transition
- cursor blinking in terminal states
- line-by-line deployment text reveal

Avoid playful motion, bounce, or decorative flourish unrelated to mood or state.

## Sound

Ambient sound is supportive, not required for comprehension. The experience should function fully without audio.

- Audio should not assume autoplay success.
- The page may begin silent or nearly silent until user interaction occurs.
- A small sound control may exist, but it must remain visually subordinate to the two main CTAs.

## Responsive Behavior

- Desktop is the primary target because this is a live-demo-first page.
- Mobile must still preserve the hero atmosphere and terminal usability.
- On small screens, preserve hierarchy by simplifying layout density rather than adding more copy.
- The terminal must remain usable on mobile with readable type, visible controls, and no horizontal scrolling.

## Accessibility

- Ensure strong contrast for all terminal text and CTA labels.
- Preserve visible focus states.
- Support keyboard activation for the main actions.
- Provide non-audio comprehension of the experience.
- Respect `prefers-reduced-motion` by reducing haze, pulses, and transition intensity.

## State Model

The frontend should model the landing page with these states:

- `idleHero`
- `terminalOpening`
- `terminalEditing`
- `deploying`
- `standbyHold`

The implementation should treat these as explicit UI states rather than loosely coupled visual toggles. This is important for animation control, keyboard behavior, and later extension into a real game handoff.

## Component Boundaries

The implementation plan should likely separate:

- hero scene and atmospheric backdrop
- command CTA cluster
- terminal overlay shell
- doctrine input and terminal copy
- deployment sequence renderer
- audio control
- shared state and transitions

These boundaries are advisory for planning, not a fixed file structure.

## Error Handling And Edge Cases

- If audio fails to load, the page should continue silently.
- If custom fonts fail, fall back cleanly without breaking layout.
- If the user deploys with an empty doctrine, allow it; the product fiction supports a sparse or reckless command input.
- If the user opens and closes the terminal repeatedly before deploy, preserve draft text consistently.

## Testing Expectations

The implementation plan should cover:

- hero renders with both main CTAs
- `WRITE YOUR DOCTRINE` enters terminal mode
- terminal close returns to hero before deploy
- typed doctrine persists across close and reopen during the same session
- `DEPLOY DEFAULT AGENT` bypasses editing
- deployment sequence advances to the final `Stand by.` state
- deploy mode locks editing and close actions until sequence completion
- reduced-motion behavior does not break the state flow

## Planning Constraints

- Keep this as a single landing-page project, not a combined landing-page-plus-game implementation.
- Do not pull in backend dependencies for the first pass.
- Favor staged realism over fake feature sprawl; a polished boot sequence is preferable to a shallow fake simulation.

## Open Questions

None for this phase. The approved direction is:

- scope `B`: hero plus interactive doctrine terminal
- audience `A`: live demo first
- terminal behavior: full-screen takeover with faint background visibility
- deploy result `A`: dramatic boot sequence ending on hold
- default-agent behavior `A`: immediate boot sequence bypassing editing
