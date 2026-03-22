"""LangGraph-based hierarchical planner: orchestrator + parallel sub-agents.

LLM backend: Kiro CLI (`kiro-cli-chat`) via asyncio subprocesses.
Falls back to AsyncAnthropic if a client is supplied, then to HeuristicPlanner.
"""

from __future__ import annotations

import asyncio
import logging
import operator
import re
from pathlib import Path
from typing import Annotated, Any, Literal, TypedDict

import orjson
from anthropic import AsyncAnthropic
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

# Kiro CLI binary — installed at this path on the dev machine
_KIRO_CLI = Path.home() / ".local/bin/kiro-cli-chat"
_WORKSPACE_ROOT = Path(__file__).resolve().parents[4]
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]|\x1b\[[?][0-9]*[lh]")
_FENCED_JSON_RE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", flags=re.DOTALL)

from watchtower_backend.domain.commands import Mission, UnitCommand
from watchtower_backend.domain.models.simulation import (
    CommandAction,
    SessionState,
    UnitType,
)
from watchtower_backend.domain.protocols import RadioSink
from watchtower_backend.services.planning.orchestrator import HeuristicPlanner
from watchtower_backend.services.planning.prompts import (
    build_orchestrator_prompt,
    build_subagent_prompt,
)
from watchtower_backend.services.planning.schemas import (
    AirSupportRequestPayload,
    OrchestratorMissionsResponse,
    SubAgentLLMPayload,
)

logger = logging.getLogger(__name__)


def _extract_json_object(raw_text: str) -> str:
    """Extract the first balanced JSON object from a raw model response."""
    fenced_match = _FENCED_JSON_RE.search(raw_text)
    if fenced_match is not None:
        return fenced_match.group(1)

    start_index: int | None = None
    depth = 0
    in_string = False
    escape = False

    for index, char in enumerate(raw_text):
        if start_index is None:
            if char == "{":
                start_index = index
                depth = 1
            continue

        if in_string:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return raw_text[start_index : index + 1]

    raise ValueError("Planner response did not contain a JSON object.")


class PlanGraphState(TypedDict, total=False):
    """Shared LangGraph state for one planning round."""

    session_json: dict[str, Any]
    missions: list[dict[str, Any]]
    orchestrator_commands: list[dict[str, Any]]
    subagent_outputs: Annotated[list[dict[str, Any]], operator.add]
    commands: list[dict[str, Any]]


def _action_allowed(unit_type: UnitType, action: CommandAction) -> bool:
    match unit_type:
        case UnitType.HELICOPTER:
            return action in {
                CommandAction.MOVE,
                CommandAction.DROP_WATER,
                CommandAction.HOLD_POSITION,
            }
        case UnitType.GROUND_CREW:
            return action in {
                CommandAction.MOVE,
                CommandAction.CREATE_FIREBREAK,
                CommandAction.HOLD_POSITION,
            }
        case UnitType.ORCHESTRATOR:
            return action is CommandAction.CALL_AIR_SUPPORT
        case _:
            return False


def _target_in_grid(session: SessionState, target: tuple[int, int]) -> bool:
    x, y = target
    return 0 <= x < session.grid_size and 0 <= y < session.grid_size


class LangGraphPlanner:
    """Hierarchical planner: Sonnet orchestrator + Haiku sub-agents (LangGraph Send).

    Primary LLM backend: Kiro CLI subprocesses (uses Kiro credits).
    Secondary: AsyncAnthropic if a client is provided.
    Tertiary: HeuristicPlanner deterministic fallback.
    """

    bundles_command_radio: bool = False

    def __init__(
        self,
        orchestrator_model: str,
        subagent_model: str,
        timeout_seconds: float,
        max_tokens: int,
        fallback_planner: HeuristicPlanner,
        anthropic_client: AsyncAnthropic | None,
        *,
        orchestrator_max_tokens: int | None = None,
        subagent_max_tokens: int | None = None,
        graph_invoke_timeout_seconds: float = 120.0,
        radio_sink: RadioSink | None = None,
        use_kiro: bool | None = None,
        workspace_root: Path | None = None,
    ) -> None:
        """Initialize the LangGraph-backed planner.

        Args:
            orchestrator_model: Anthropic model id for mission planning.
            subagent_model: Anthropic model id for per-unit tactics.
            timeout_seconds: Per-LLM-call timeout.
            max_tokens: Default max output tokens (used if specific caps are None).
            fallback_planner: Heuristic planner when LLM or graph fails.
            anthropic_client: Async Anthropic client, or None to force fallback.
            orchestrator_max_tokens: Optional cap for orchestrator responses.
            subagent_max_tokens: Optional cap for sub-agent responses.
            graph_invoke_timeout_seconds: Wall-clock cap for the full planning graph.
            radio_sink: When set, sub-agent `radio_message` lines are queued for TTS/Luffa.
            use_kiro: Force-enable or force-disable Kiro. Defaults to auto-detect.
            workspace_root: Project root for workspace-local Kiro agent discovery.
        """
        self._orchestrator_model = orchestrator_model
        self._subagent_model = subagent_model
        self._timeout_seconds = timeout_seconds
        self._graph_invoke_timeout = graph_invoke_timeout_seconds
        self._orch_max = orchestrator_max_tokens or max_tokens
        self._sub_max = subagent_max_tokens or max(256, min(max_tokens, 600))
        self._fallback_planner = fallback_planner
        self._client = anthropic_client
        self._radio_sink = radio_sink
        self._workspace_root = workspace_root or _WORKSPACE_ROOT
        self._use_kiro = _KIRO_CLI.exists() if use_kiro is None else use_kiro
        if self._use_kiro:
            logger.info(
                "Kiro CLI enabled at %s with workspace root %s.",
                _KIRO_CLI,
                self._workspace_root,
            )
        self._graph = self._compile_graph()

    def _compile_graph(self) -> object:
        graph = StateGraph(PlanGraphState)
        graph.add_node("orchestrator", self._orchestrator_node)
        graph.add_node("subagent", self._subagent_node)
        graph.add_node("join", self._join_node)
        graph.add_node("validate", self._validate_node)
        graph.add_edge(START, "orchestrator")
        graph.add_conditional_edges(
            "orchestrator",
            self._route_from_orchestrator,
            ["subagent", "validate"],
        )
        graph.add_edge("subagent", "join")
        graph.add_edge("join", "validate")
        graph.add_edge("validate", END)
        return graph.compile()

    async def _call_kiro(self, agent_name: str, prompt: str) -> str:
        """Call Kiro CLI in non-interactive mode and return the plain-text response.

        Args:
            agent_name: Name of the Kiro agent config (e.g. 'watchtower-orchestrator').
            prompt: Full user-turn prompt to pipe into the process via stdin.

        Returns:
            Stripped response text with ANSI escape codes removed.

        Raises:
            RuntimeError: If the process exits with a non-zero code.
            asyncio.TimeoutError: If the call exceeds `_timeout_seconds`.
        """
        proc = await asyncio.create_subprocess_exec(
            str(_KIRO_CLI),
            "chat",
            "--agent", agent_name,
            "--no-interactive",
            cwd=str(self._workspace_root),
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate(prompt.encode())
        stderr_text = stderr.decode(errors="replace").strip()
        if proc.returncode != 0:
            raise RuntimeError(
                f"Kiro agent '{agent_name}' failed with exit code {proc.returncode}: {stderr_text or 'no stderr'}"
            )
        raw = stdout.decode(errors="replace")
        # Strip ANSI escape sequences and the "▸ Credits: X • Time: Xs" footer
        clean = _ANSI_RE.sub("", raw)
        # Remove the "▸ ..." credit line kiro appends
        clean = re.sub(r"▸[^\n]*\n?", "", clean)
        # Remove the "> " prompt echo prefix kiro prints before the response
        clean = re.sub(r"^>\s*", "", clean, flags=re.MULTILINE)
        return clean.strip()

    async def plan(self, session_state: SessionState) -> list[UnitCommand]:
        """Run orchestrator + parallel sub-agents, validate, then return commands.

        Args:
            session_state: Deep-copied session snapshot for planning.

        Returns:
            Validated unit commands, or heuristic fallback on failure.
        """
        if self._client is None and not self._use_kiro:
            return await self._fallback_planner.plan(session_state=session_state)

        initial: PlanGraphState = {
            "session_json": session_state.model_dump(mode="json"),
            "missions": [],
            "orchestrator_commands": [],
            "subagent_outputs": [],
            "commands": [],
        }
        try:
            result = await asyncio.wait_for(
                self._graph.ainvoke(initial),
                timeout=self._graph_invoke_timeout,
            )
        except Exception as error:
            logger.warning(
                "LangGraph planner invoke failed; using heuristic fallback.",
                extra={"session_id": session_state.id, "error": str(error)},
            )
            return await self._fallback_planner.plan(session_state=session_state)

        raw_commands = result.get("commands") or []
        if not raw_commands:
            return await self._fallback_planner.plan(session_state=session_state)

        commands = [UnitCommand.model_validate(row) for row in raw_commands]
        await self._publish_subagent_radios(
            session_state=session_state,
            outputs=result.get("subagent_outputs") or [],
        )
        return commands

    async def _publish_subagent_radios(
        self,
        *,
        session_state: SessionState,
        outputs: list[dict[str, Any]],
    ) -> None:
        if self._radio_sink is None:
            return
        from watchtower_backend.domain.events import RadioMessage

        for row in outputs:
            if not row.get("ok"):
                continue
            unit_id = str(row.get("unit_id", ""))
            text = str(row.get("radio_message", "")).strip()
            if not text:
                continue
            unit = next((u for u in session_state.units if u.id == unit_id), None)
            if unit is None or unit.unit_type is UnitType.ORCHESTRATOR:
                continue
            voice = (
                "helicopter"
                if unit.unit_type is UnitType.HELICOPTER
                else "ground"
                if unit.unit_type is UnitType.GROUND_CREW
                else "command"
            )
            await self._radio_sink.publish(
                session_state=session_state,
                message=RadioMessage(speaker=unit.label, voice_key=voice, text=text),
            )

    async def _orchestrator_node(self, state: PlanGraphState) -> dict[str, Any]:
        session = SessionState.model_validate(state["session_json"])
        if not session.fire_cells:
            return {"missions": []}
        prompt = build_orchestrator_prompt(session_state=session)
        try:
            if self._use_kiro:
                content = await asyncio.wait_for(
                    self._call_kiro("watchtower-orchestrator", prompt),
                    timeout=self._timeout_seconds,
                )
            else:
                response = await asyncio.wait_for(
                    self._client.messages.create(
                        model=self._orchestrator_model,
                        max_tokens=self._orch_max,
                        system=(
                            "You are the incident orchestrator. "
                            "Respond only with valid JSON matching the requested schema."
                        ),
                        messages=[{"role": "user", "content": prompt}],
                    ),
                    timeout=self._timeout_seconds,
                )
                content = "".join(
                    block.text
                    for block in response.content
                    if getattr(block, "type", None) == "text"
                )
            parsed = OrchestratorMissionsResponse.model_validate(
                orjson.loads(_extract_json_object(raw_text=content))
            )
            missions_out: list[dict[str, Any]] = []
            direct_commands: list[dict[str, Any]] = []
            valid_ids = {
                u.id for u in session.units if u.unit_type is not UnitType.ORCHESTRATOR
            }
            for row in parsed.missions:
                if row.agent_id not in valid_ids:
                    continue
                if not _target_in_grid(session, (row.target_x, row.target_y)):
                    continue
                missions_out.append(
                    {
                        "agent_id": row.agent_id,
                        "intent": row.intent,
                        "target_x": row.target_x,
                        "target_y": row.target_y,
                        "priority": row.priority,
                        "reason": row.reason,
                    }
                )
            if session.air_support_missions:
                return {"missions": missions_out, "orchestrator_commands": []}

            valid_requests = sorted(
                parsed.air_support_requests,
                key=lambda request: request.priority,
                reverse=True,
            )
            for request in valid_requests[:1]:
                if not _target_in_grid(session, (request.target_x, request.target_y)):
                    continue
                if (
                    request.drop_start_x is not None
                    and request.drop_start_y is not None
                    and not _target_in_grid(session, (request.drop_start_x, request.drop_start_y))
                ):
                    continue
                if (
                    request.drop_end_x is not None
                    and request.drop_end_y is not None
                    and not _target_in_grid(session, (request.drop_end_x, request.drop_end_y))
                ):
                    continue
                direct_commands.append(
                    self._air_support_request_to_command(
                        session=session,
                        request=request,
                    ).model_dump(mode="json")
                )
            return {"missions": missions_out, "orchestrator_commands": direct_commands}
        except Exception as error:
            logger.warning(
                "Orchestrator node failed.",
                extra={"session_id": session.id, "error": str(error)},
            )
            return {"missions": [], "orchestrator_commands": []}

    def _route_from_orchestrator(
        self, state: PlanGraphState
    ) -> list[Send] | Literal["validate"]:
        missions = state.get("missions") or []
        if not missions:
            return "validate"
        session_json = state["session_json"]
        return [
            Send(
                "subagent",
                {"mission": mission, "session_json": session_json},
            )
            for mission in missions
        ]

    async def _subagent_node(self, state: dict[str, Any]) -> dict[str, Any]:
        session = SessionState.model_validate(state["session_json"])
        mission_dict = state["mission"]
        mission = Mission(
            agent_id=mission_dict["agent_id"],
            intent=mission_dict["intent"],
            target=(int(mission_dict["target_x"]), int(mission_dict["target_y"])),
            priority=int(mission_dict.get("priority", 0)),
            reason=str(mission_dict.get("reason", "")),
        )
        priority = mission.priority
        unit = next((u for u in session.units if u.id == mission.agent_id), None)
        if unit is None or unit.unit_type is UnitType.ORCHESTRATOR:
            return {"subagent_outputs": [{"ok": False, "unit_id": mission.agent_id}]}

        prompt = build_subagent_prompt(session_state=session, mission=mission)
        try:
            if self._use_kiro:
                content = await asyncio.wait_for(
                    self._call_kiro("watchtower-subagent", prompt),
                    timeout=self._timeout_seconds,
                )
            else:
                response = await asyncio.wait_for(
                    self._client.messages.create(
                        model=self._subagent_model,
                        max_tokens=self._sub_max,
                        system=(
                            "You are a tactical wildfire agent for a single unit. "
                            "Respond only with valid JSON matching the requested schema."
                        ),
                        messages=[{"role": "user", "content": prompt}],
                    ),
                    timeout=self._timeout_seconds,
                )
                content = "".join(
                    block.text
                    for block in response.content
                    if getattr(block, "type", None) == "text"
                )
            payload = SubAgentLLMPayload.model_validate(
                orjson.loads(_extract_json_object(raw_text=content))
            )
        except Exception as error:
            logger.warning(
                "Subagent node failed.",
                extra={"session_id": session.id, "unit": mission.agent_id, "error": str(error)},
            )
            return {"subagent_outputs": [{"ok": False, "unit_id": mission.agent_id}]}

        if payload.unit_id != mission.agent_id:
            return {"subagent_outputs": [{"ok": False, "unit_id": mission.agent_id}]}

        target = (payload.target_x, payload.target_y)
        if not _target_in_grid(session, target):
            return {"subagent_outputs": [{"ok": False, "unit_id": mission.agent_id}]}

        if not _action_allowed(unit.unit_type, payload.action):
            return {"subagent_outputs": [{"ok": False, "unit_id": mission.agent_id}]}

        command = UnitCommand(
            session_id=session.id,
            unit_id=payload.unit_id,
            action=payload.action,
            target=target,
            rationale=payload.rationale,
            state_version=session.version,
        )
        return {
            "subagent_outputs": [
                {
                    "ok": True,
                    "unit_id": payload.unit_id,
                    "priority": priority,
                    "radio_message": payload.radio_message,
                    "command": command.model_dump(mode="json"),
                }
            ]
        }

    async def _join_node(self, state: PlanGraphState) -> dict[str, Any]:
        _ = state
        return {}

    async def _validate_node(self, state: PlanGraphState) -> dict[str, Any]:
        session = SessionState.model_validate(state["session_json"])
        commands: list[UnitCommand] = []

        for row in state.get("orchestrator_commands") or []:
            try:
                cmd = UnitCommand.model_validate(row)
            except Exception:
                continue
            unit = next((u for u in session.units if u.id == cmd.unit_id), None)
            if unit is None or unit.unit_type is not UnitType.ORCHESTRATOR:
                continue
            if cmd.state_version != session.version:
                continue
            if not _action_allowed(unit.unit_type, cmd.action):
                continue
            if not _target_in_grid(session, cmd.target):
                continue
            if cmd.action is CommandAction.CALL_AIR_SUPPORT and cmd.air_support_payload is None:
                continue
            if cmd.drop_start is not None and not _target_in_grid(session, cmd.drop_start):
                continue
            if cmd.drop_end is not None and not _target_in_grid(session, cmd.drop_end):
                continue
            commands.append(cmd)

        raw = [row for row in (state.get("subagent_outputs") or []) if row.get("ok")]
        raw.sort(key=lambda row: int(row.get("priority", 0)), reverse=True)
        seen: set[str] = set()
        for row in raw:
            unit_id = str(row.get("unit_id", ""))
            if unit_id in seen:
                continue
            seen.add(unit_id)
            try:
                cmd = UnitCommand.model_validate(row["command"])
            except Exception:
                continue
            unit = next((u for u in session.units if u.id == cmd.unit_id), None)
            if unit is None or unit.unit_type is UnitType.ORCHESTRATOR:
                continue
            if cmd.state_version != session.version:
                continue
            if not _action_allowed(unit.unit_type, cmd.action):
                continue
            if not _target_in_grid(session, cmd.target):
                continue
            commands.append(cmd)

        return {"commands": [c.model_dump(mode="json") for c in commands]}

    def _air_support_request_to_command(
        self,
        *,
        session: SessionState,
        request: AirSupportRequestPayload,
    ) -> UnitCommand:
        """Convert one orchestrator air-support request into a validated command shell."""
        drop_start = None
        if request.drop_start_x is not None and request.drop_start_y is not None:
            drop_start = (request.drop_start_x, request.drop_start_y)
        drop_end = None
        if request.drop_end_x is not None and request.drop_end_y is not None:
            drop_end = (request.drop_end_x, request.drop_end_y)
        return UnitCommand(
            session_id=session.id,
            unit_id="tower",
            action=CommandAction.CALL_AIR_SUPPORT,
            target=(request.target_x, request.target_y),
            rationale=request.rationale,
            state_version=session.version,
            air_support_payload=request.payload_type,
            approach_points=[(point.x, point.y) for point in request.approach_points],
            drop_start=drop_start,
            drop_end=drop_end,
        )
