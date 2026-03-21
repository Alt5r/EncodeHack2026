"""Luffa group bot: commands, formatted radio relay, and high-signal session alerts."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

from luffa_bot import polling as luffa_polling
from luffa_bot.client import AsyncLuffaClient
from luffa_bot.models import ConfirmButton, GroupMessagePayload, IncomingEnvelope, IncomingMessage

from watchtower_backend.core.errors import SessionNotFoundError
from watchtower_backend.domain.events import RadioMessage, SessionEvent
from watchtower_backend.domain.models.simulation import SessionState, UnitType, VillageState
from watchtower_backend.services.sessions.manager import SessionManager

logger = logging.getLogger(__name__)


def format_radio_line(message: RadioMessage) -> str:
    """Format a radio message for the Luffa mission log.

    Args:
        message: Domain radio payload from the simulation or planner.

    Returns:
        Single-line text suitable for `send_to_group`.
    """
    voice_key = message.voice_key.lower()
    if voice_key == "command":
        prefix = "📡 COMMAND"
    elif voice_key == "helicopter":
        prefix = "🚁"
    elif voice_key == "ground":
        prefix = "🌲"
    else:
        prefix = "📻"
    return f"{prefix} {message.speaker}: {message.text}"


def _parse_cell(cell: object) -> tuple[int, int] | None:
    if isinstance(cell, (list, tuple)) and len(cell) == 2:
        try:
            return (int(cell[0]), int(cell[1]))
        except (TypeError, ValueError):
            return None
    return None


def _manhattan(a: tuple[int, int], b: tuple[int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def fire_spread_near_village(cells_raw: object, village: VillageState, threshold: int = 4) -> bool:
    """Return True if any new fire cell is within `threshold` Manhattan steps of village tiles."""
    if not isinstance(cells_raw, list) or not cells_raw:
        return False
    vx, vy = village.top_left
    village_cells: list[tuple[int, int]] = []
    for dx in range(village.size):
        for dy in range(village.size):
            village_cells.append((vx + dx, vy + dy))
    for item in cells_raw:
        c = _parse_cell(item)
        if c is None:
            continue
        for vc in village_cells:
            if _manhattan(c, vc) <= threshold:
                return True
    return False


def format_status_summary(state: SessionState) -> str:
    """Build a short human-readable status string for chat."""
    wind = state.wind
    score = state.score
    return (
        f"Session {state.id[:8]}… status={state.status.value} tick={state.tick}\n"
        f"Wind {wind.direction} @ {wind.speed_mph:.1f} mph | "
        f"Fire cells: {len(state.fire_cells)} | Village intact: {state.village.is_intact}\n"
        f"Score — damage {score.village_damage}, burned {score.burned_cells}, "
        f"suppressed {score.suppressed_cells}, firebreaks {score.firebreak_cells}"
    )


def format_agents_summary(state: SessionState) -> str:
    """List operational units and positions."""
    lines: list[str] = []
    for unit in state.units:
        if unit.unit_type is UnitType.ORCHESTRATOR:
            continue
        pos = unit.position
        lines.append(
            f"- {unit.label} ({unit.unit_type.value}) @ {pos[0]},{pos[1]} "
            f"| water {unit.water_remaining}/{unit.water_capacity} | {unit.status_text}"
        )
    if not lines:
        return "No field units."
    return "Units:\n" + "\n".join(lines)


def format_fire_summary(state: SessionState) -> str:
    """Summarize fire relative to the village."""
    village = state.village
    vx, vy = village.top_left
    village_cells = {
        (vx + dx, vy + dy) for dx in range(village.size) for dy in range(village.size)
    }
    if not state.fire_cells:
        return "No active fire cells."
    min_dist = min(
        min(_manhattan(fc, vc) for vc in village_cells) for fc in state.fire_cells
    )
    threat = "Fire has entered the village." if village_cells.intersection(state.fire_cells) else ""
    n_fire = len(state.fire_cells)
    head = f"Fire fronts: {n_fire} cell(s). Closest to village edge: ~{min_dist} steps."
    return f"{head}\n{threat}".strip()


class LuffaBot:
    """Interactive Luffa group bot wired to `SessionManager` and optional radio relay."""

    def __init__(
        self,
        *,
        client: AsyncLuffaClient,
        group_uid: str,
        session_manager: SessionManager,
    ) -> None:
        """Initialize the bot.

        Args:
            client: Async Luffa API client (owns its httpx pool).
            group_uid: Target group channel uid.
            session_manager: Live session registry and factories.
        """
        self._client = client
        self._group_uid = group_uid
        self._session_manager = session_manager
        self._luffa_sessions: set[str] = set()
        self._primary_session_id: str | None = None
        self._pending_doctrine: str | None = None
        self._deploy_lock = asyncio.Lock()

    def register_session_id(self, session_id: str) -> None:
        """Remember a session started from this channel."""
        self._luffa_sessions.add(session_id)
        self._primary_session_id = session_id

    async def relay_radio_message(self, message: RadioMessage) -> None:
        """Relay a radio line to the configured Luffa group."""
        line = format_radio_line(message)
        await self._client.send_to_group(self._group_uid, line, message_type=1)

    def build_session_listener(self) -> Callable[[SessionEvent], Awaitable[None]]:
        """Return an async listener suitable for `SessionManager.create_session`."""

        async def _listener(event: SessionEvent) -> None:
            await self.handle_session_event(event=event)

        return _listener

    def build_register_hook(self) -> Callable[[str], None]:
        """Return a sync hook that registers the session id before the runtime loop starts."""

        def _hook(session_id: str) -> None:
            self.register_session_id(session_id=session_id)

        return _hook

    async def handle_session_event(self, event: SessionEvent) -> None:
        """Post high-signal alerts for Luffa-started sessions."""
        if event.session_id not in self._luffa_sessions:
            return

        if event.type == "session.completed":
            self._luffa_sessions.discard(event.session_id)
            if self._primary_session_id == event.session_id:
                self._primary_session_id = None

        text: str | None = None
        if event.type == "session.started":
            title = event.payload.get("doctrine_title", "Session")
            text = f"▶️ Session started ({event.session_id[:8]}…): {title}"
        elif event.type == "session.completed":
            status = event.payload.get("status", "?")
            score = event.payload.get("score", {})
            if isinstance(score, dict):
                text = (
                    f"🏁 Session {status} ({event.session_id[:8]}…). "
                    f"Village damage {score.get('village_damage', '?')}, "
                    f"burned cells {score.get('burned_cells', '?')}."
                )
            else:
                text = f"🏁 Session {status} ({event.session_id[:8]}…)."
        elif event.type == "simulation.fire_spread":
            cells = event.payload.get("cells")
            try:
                state = await self._session_manager.get_session(event.session_id)
            except SessionNotFoundError:
                return
            if not fire_spread_near_village(cells_raw=cells, village=state.village):
                return
            n = len(cells) if isinstance(cells, list) else 0
            text = f"🔥 Fire spreading near the village — {n} new front cell(s)."

        if text is None:
            return
        try:
            await self._client.send_to_group(self._group_uid, text, message_type=1)
        except Exception as exc:
            logger.warning("luffa session announce failed", extra={"error": str(exc)})

    async def run_forever(self) -> None:
        """Poll Luffa until cancelled (caller closes `AsyncLuffaClient`)."""
        try:
            await luffa_polling.run(
                self._client,
                handler=self._handle_incoming,
                interval=1.0,
                concurrency=3,
                dedupe=True,
                on_error=self._on_poll_error,
            )
        except asyncio.CancelledError:
            raise

    async def _on_poll_error(self, exc: Exception) -> None:
        logger.warning("luffa polling error", extra={"error": str(exc)}, exc_info=True)

    async def _handle_incoming(
        self,
        msg: IncomingMessage,
        env: IncomingEnvelope,
        client: AsyncLuffaClient,
    ) -> None:
        _ = client
        if env.type != 1 or env.uid != self._group_uid:
            return
        raw = (msg.text or "").strip()
        if not raw:
            return
        lowered = raw.lower()
        try:
            if raw == "deploy_yes":
                await self._confirm_deploy()
            elif raw == "deploy_no":
                await self._cancel_deploy()
            elif lowered.startswith("/deploy"):
                await self._cmd_deploy(raw=raw)
            elif lowered.startswith("/status"):
                await self._cmd_status(raw=raw)
            elif lowered.startswith("/agents"):
                await self._cmd_agents(raw=raw)
            elif lowered.startswith("/fire"):
                await self._cmd_fire(raw=raw)
            elif lowered.startswith("/leaderboard"):
                await self._cmd_leaderboard()
            elif lowered.startswith("/help"):
                await self._cmd_help()
        except Exception as exc:
            logger.warning("luffa command failed", extra={"error": str(exc)}, exc_info=True)
            await self._safe_reply(text=f"Error: {exc!s}")

    async def _safe_reply(self, text: str) -> None:
        try:
            await self._client.send_to_group(self._group_uid, text, message_type=1)
        except Exception as exc:
            logger.warning("luffa reply failed", extra={"error": str(exc)})

    async def _confirm_deploy(self) -> None:
        async with self._deploy_lock:
            doctrine = self._pending_doctrine
            self._pending_doctrine = None
        if not doctrine:
            await self._safe_reply(text="No deployment pending.")
            return
        listener = self.build_session_listener()
        hook = self.build_register_hook()
        try:
            await self._session_manager.create_session(
                doctrine_text=doctrine,
                session_event_listener=listener,
                register_session_hook=hook,
            )
        except Exception as exc:
            await self._safe_reply(text=f"Could not start session: {exc!s}")
            return
        await self._safe_reply(text="Deployment confirmed — session is live.")

    async def _cancel_deploy(self) -> None:
        async with self._deploy_lock:
            self._pending_doctrine = None
        await self._safe_reply(text="Deployment cancelled.")

    async def _cmd_deploy(self, raw: str) -> None:
        rest = raw[len("/deploy") :].strip()
        if not rest:
            await self._safe_reply(
                text=(
                    "Usage: /deploy <doctrine text> — describe your strategy, "
                    "then confirm with buttons."
                ),
            )
            return
        if len(rest) > 8000:
            await self._safe_reply(text="Doctrine too long (max 8000 characters).")
            return
        preview = rest if len(rest) <= 120 else f"{rest[:120]}…"
        async with self._deploy_lock:
            self._pending_doctrine = rest
        payload = GroupMessagePayload(
            text=f"Deploy this doctrine?\n\n\"{preview}\"",
            confirm=[
                ConfirmButton(name="Deploy", selector="deploy_yes", type="default"),
                ConfirmButton(name="Cancel", selector="deploy_no", type="destructive"),
            ],
        )
        await self._client.send_to_group(self._group_uid, payload, message_type=2)

    async def _pick_session(self, arg: str) -> SessionState | None:
        """Resolve session from optional id / prefix, else single tracked active session."""
        active = await self._session_manager.list_sessions()
        tracked = [s for s in active if s.id in self._luffa_sessions]
        if arg:
            try:
                st = await self._session_manager.get_session(arg)
                return st if st.id in self._luffa_sessions else None
            except SessionNotFoundError:
                pass
            for s in tracked:
                if s.id.startswith(arg):
                    return s
            return None
        if not tracked:
            return None
        if len(tracked) == 1:
            return tracked[0]
        if self._primary_session_id:
            for s in tracked:
                if s.id == self._primary_session_id:
                    return s
        return None

    async def _cmd_status(self, raw: str) -> None:
        arg = raw[len("/status") :].strip()
        state = await self._pick_session(arg=arg)
        if state is None:
            active = await self._session_manager.list_sessions()
            tracked = [s for s in active if s.id in self._luffa_sessions]
            if len(tracked) > 1:
                ids = ", ".join(s.id[:8] for s in tracked)
                await self._safe_reply(
                    text=f"Multiple Luffa sessions: {ids}. Use /status <session_id_prefix>.",
                )
            else:
                await self._safe_reply(text="No active Luffa session. Use /deploy.")
            return
        await self._safe_reply(text=format_status_summary(state=state))

    async def _cmd_agents(self, raw: str) -> None:
        arg = raw[len("/agents") :].strip()
        state = await self._pick_session(arg=arg)
        if state is None:
            await self._safe_reply(text="No session to show. Use /deploy or /status.")
            return
        await self._safe_reply(text=format_agents_summary(state=state))

    async def _cmd_fire(self, raw: str) -> None:
        arg = raw[len("/fire") :].strip()
        state = await self._pick_session(arg=arg)
        if state is None:
            await self._safe_reply(text="No session to show. Use /deploy or /status.")
            return
        await self._safe_reply(text=format_fire_summary(state=state))

    async def _cmd_leaderboard(self) -> None:
        rows = await self._session_manager.list_leaderboard_top(limit=10)
        if not rows:
            await self._safe_reply(text="Leaderboard is empty.")
            return
        lines: list[str] = []
        for i, row in enumerate(rows, start=1):
            lines.append(
                f"{i}. {row.doctrine_title[:40]} — {row.outcome} "
                f"(damage {row.village_damage}, time {row.time_elapsed_seconds}s)"
            )
        await self._safe_reply(text="Top runs:\n" + "\n".join(lines))

    async def _cmd_help(self) -> None:
        await self._safe_reply(
            text=(
                "Commands: /deploy <doctrine>, /status [id], /agents [id], "
                "/fire [id], /leaderboard, /help"
            ),
        )
