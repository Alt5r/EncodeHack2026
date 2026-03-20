from __future__ import annotations

from dataclasses import asdict, dataclass, field
import json
from pathlib import Path
from typing import Any, Iterable


def _shorten(value: str | None, limit: int = 280) -> str:
    if not value:
        return ""
    value = " ".join(value.split())
    if len(value) <= limit:
        return value
    return value[: limit - 3] + "..."


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, sort_keys=True)
    except TypeError:
        return str(value)


def parse_json_line(line: str) -> dict[str, Any] | None:
    line = line.strip()
    if not line:
        return None
    if not (line.startswith("{") and line.endswith("}")):
        return None
    try:
        payload = json.loads(line)
    except json.JSONDecodeError:
        return None
    return payload if isinstance(payload, dict) else None


def _extract_text_parts(value: Any) -> list[str]:
    results: list[str] = []
    if isinstance(value, str):
        results.append(value)
        return results
    if isinstance(value, list):
        for item in value:
            results.extend(_extract_text_parts(item))
        return results
    if not isinstance(value, dict):
        return results

    for key in ("text", "delta", "message", "summary"):
        text = value.get(key)
        if isinstance(text, str) and text:
            results.append(text)

    content = value.get("content")
    if isinstance(content, (list, dict)):
        results.extend(_extract_text_parts(content))

    raw_content = value.get("rawContent")
    if isinstance(raw_content, (list, dict)):
        results.extend(_extract_text_parts(raw_content))

    item = value.get("item")
    if isinstance(item, dict):
        results.extend(_extract_text_parts(item))

    return results


@dataclass
class ToolActivity:
    name: str
    status: str
    call_id: str | None = None
    title: str | None = None
    input_preview: str = ""
    output_preview: str = ""


@dataclass
class ReasoningSignal:
    event_type: str
    preview: str


@dataclass
class CodexWorkerPacket:
    source: str
    task: str
    status: str
    thread_id: str | None
    turn_count: int
    event_types: list[str] = field(default_factory=list)
    visible_output: str = ""
    final_message: str = ""
    tool_activity: list[ToolActivity] = field(default_factory=list)
    reasoning_signals: list[ReasoningSignal] = field(default_factory=list)
    handoffs: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    non_json_output: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "task": self.task,
            "status": self.status,
            "thread_id": self.thread_id,
            "turn_count": self.turn_count,
            "event_types": self.event_types,
            "visible_output": self.visible_output,
            "final_message": self.final_message,
            "tool_activity": [asdict(item) for item in self.tool_activity],
            "reasoning_signals": [asdict(item) for item in self.reasoning_signals],
            "handoffs": self.handoffs,
            "errors": self.errors,
            "non_json_output": self.non_json_output,
        }

    def to_markdown(self) -> str:
        tool_lines = "\n".join(
            f"- {item.name} [{item.status}] id={item.call_id or 'n/a'} "
            f"input={item.input_preview or 'n/a'} output={item.output_preview or 'n/a'}"
            for item in self.tool_activity
        ) or "- none"
        reasoning_lines = "\n".join(
            f"- {item.event_type}: {item.preview}" for item in self.reasoning_signals
        ) or "- none"
        error_lines = "\n".join(f"- {item}" for item in self.errors) or "- none"
        output_lines = self.visible_output or self.final_message or "(no visible output captured)"
        non_json_lines = "\n".join(f"- {item}" for item in self.non_json_output[:10]) or "- none"

        return "\n".join(
            [
                "CODEX_WORKER_PACKET",
                f"task: {self.task}",
                f"source: {self.source}",
                f"status: {self.status}",
                f"thread_id: {self.thread_id or 'n/a'}",
                f"turn_count: {self.turn_count}",
                f"event_types: {', '.join(self.event_types) if self.event_types else 'none'}",
                "visible_output:",
                output_lines,
                "tool_activity:",
                tool_lines,
                "reasoning_signals:",
                reasoning_lines,
                "errors:",
                error_lines,
                "non_json_output:",
                non_json_lines,
            ]
        )


class CodexStreamAggregator:
    def __init__(self, task: str, source: str) -> None:
        self.task = task
        self.source = source
        self.thread_id: str | None = None
        self.turn_count = 0
        self.event_types: list[str] = []
        self.visible_fragments: list[str] = []
        self.final_message = ""
        self.tool_activity: list[ToolActivity] = []
        self.reasoning_signals: list[ReasoningSignal] = []
        self.handoffs: list[str] = []
        self.errors: list[str] = []
        self.non_json_output: list[str] = []
        self.status = "running"

    def add_non_json_output(self, line: str) -> None:
        line = line.strip()
        if line:
            self.non_json_output.append(_shorten(line, limit=400))

    def consume(self, event: dict[str, Any]) -> None:
        event_type = str(event.get("type", "unknown"))
        self.event_types.append(event_type)

        thread_id = event.get("thread_id")
        if isinstance(thread_id, str):
            self.thread_id = thread_id

        if event_type == "turn.started":
            self.turn_count += 1
        elif event_type == "turn.completed":
            if self.status != "failed":
                self.status = "completed"

        if event_type == "error":
            message = _shorten(_as_text(event.get("message")), limit=500)
            if message:
                self.errors.append(message)
                self.status = "failed"

        if event_type == "message.completed":
            message = _shorten(_as_text(event.get("message")), limit=2000)
            if message:
                self.final_message = message

        if "handoff" in event_type:
            summary = _shorten(" ".join(_extract_text_parts(event)), limit=300)
            if summary:
                self.handoffs.append(summary)

        if "reasoning" in event_type:
            preview = _shorten(" ".join(_extract_text_parts(event)), limit=300)
            if preview:
                self.reasoning_signals.append(
                    ReasoningSignal(event_type=event_type, preview=preview)
                )

        if "tool" in event_type:
            self._record_tool_activity(event, event_type)

        item = event.get("item")
        if isinstance(item, dict):
            self._consume_item(item, fallback_event_type=event_type)

        if not self.final_message:
            text = _shorten(" ".join(_extract_text_parts(event)), limit=1000)
            if text and text not in self.visible_fragments:
                if event_type not in {"thread.started", "turn.started", "turn.completed"}:
                    self.visible_fragments.append(text)

    def _consume_item(self, item: dict[str, Any], fallback_event_type: str) -> None:
        item_type = str(item.get("type", "unknown"))
        if item_type == "error":
            message = _shorten(_as_text(item.get("message")), limit=500)
            if message:
                self.errors.append(message)
                self.status = "failed"

        if item_type == "reasoning":
            preview = _shorten(" ".join(_extract_text_parts(item)), limit=300)
            if preview:
                self.reasoning_signals.append(
                    ReasoningSignal(event_type=fallback_event_type, preview=preview)
                )

        if item_type in {"message", "assistant_message", "output_text"}:
            text = _shorten(" ".join(_extract_text_parts(item)), limit=2000)
            if text:
                self.final_message = text

        if "tool" in item_type or "tool" in fallback_event_type:
            merged = dict(item)
            merged.setdefault("type", fallback_event_type)
            self._record_tool_activity(merged, fallback_event_type)

    def _record_tool_activity(self, payload: dict[str, Any], event_type: str) -> None:
        name = (
            payload.get("tool")
            or payload.get("name")
            or payload.get("title")
            or payload.get("kind")
            or "tool"
        )
        status = (
            payload.get("status")
            or ("completed" if "completed" in event_type else "pending")
            or "pending"
        )
        call_id = payload.get("toolCallId") or payload.get("call_id") or payload.get("id")
        input_preview = _shorten(
            _as_text(payload.get("input") or payload.get("arguments") or payload.get("command")),
            limit=220,
        )
        output_preview = _shorten(
            _as_text(payload.get("output") or payload.get("result") or payload.get("content")),
            limit=220,
        )
        self.tool_activity.append(
            ToolActivity(
                name=_shorten(str(name), limit=120),
                status=_shorten(str(status), limit=120),
                call_id=_shorten(str(call_id), limit=120) if call_id else None,
                title=_shorten(_as_text(payload.get("title")), limit=200) or None,
                input_preview=input_preview,
                output_preview=output_preview,
            )
        )

    def finalize(self) -> CodexWorkerPacket:
        visible_output = " ".join(self.visible_fragments).strip()
        if self.status == "running":
            self.status = "completed" if self.final_message or visible_output else "failed"
        elif self.status == "completed" and self.errors:
            self.status = "failed"

        return CodexWorkerPacket(
            source=self.source,
            task=self.task,
            status=self.status,
            thread_id=self.thread_id,
            turn_count=self.turn_count,
            event_types=self.event_types,
            visible_output=visible_output,
            final_message=self.final_message,
            tool_activity=self.tool_activity,
            reasoning_signals=self.reasoning_signals,
            handoffs=self.handoffs,
            errors=self.errors,
            non_json_output=self.non_json_output,
        )


def load_mock_events(path: Path) -> tuple[list[str], list[dict[str, Any]]]:
    raw_lines = path.read_text().splitlines()
    events: list[dict[str, Any]] = []
    for line in raw_lines:
        parsed = parse_json_line(line)
        if parsed is not None:
            events.append(parsed)
    return raw_lines, events


def write_packet_files(output_dir: Path, packet: CodexWorkerPacket, raw_lines: Iterable[str]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "codex-events.jsonl").write_text("\n".join(raw_lines).rstrip() + "\n")
    (output_dir / "codex-worker-packet.json").write_text(
        json.dumps(packet.to_dict(), indent=2) + "\n"
    )
    (output_dir / "codex-worker-packet.md").write_text(packet.to_markdown() + "\n")
