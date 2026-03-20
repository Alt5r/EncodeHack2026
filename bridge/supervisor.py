from __future__ import annotations

import json
from pathlib import Path
import subprocess
from typing import Any

from .codex_events import (
    CodexStreamAggregator,
    CodexWorkerPacket,
    load_mock_events,
    parse_json_line,
    write_packet_files,
)
from .kiro_acp import KiroACPClient, KiroACPError, PromptTurn


def run_mock_codex(task: str, fixture_path: Path, output_dir: Path) -> CodexWorkerPacket:
    raw_lines, events = load_mock_events(fixture_path)
    aggregator = CodexStreamAggregator(task=task, source=f"mock:{fixture_path.name}")
    for line in raw_lines:
        parsed = parse_json_line(line)
        if parsed is None:
            aggregator.add_non_json_output(line)
            continue
        aggregator.consume(parsed)
    packet = aggregator.finalize()
    write_packet_files(output_dir, packet, raw_lines)
    return packet


def run_live_codex(
    *,
    task: str,
    prompt: str,
    cwd: Path,
    output_dir: Path,
    model: str | None = None,
    sandbox: str = "read-only",
) -> CodexWorkerPacket:
    cmd = [
        "codex",
        "exec",
        "--json",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        sandbox,
    ]
    if model:
        cmd.extend(["--model", model])
    cmd.append(prompt)

    raw_lines: list[str] = []
    aggregator = CodexStreamAggregator(task=task, source="codex exec --json")

    proc = subprocess.Popen(
        cmd,
        cwd=str(cwd),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    assert proc.stdout is not None
    for raw_line in proc.stdout:
        line = raw_line.rstrip("\n")
        raw_lines.append(line)
        parsed = parse_json_line(line)
        if parsed is None:
            aggregator.add_non_json_output(line)
            continue
        aggregator.consume(parsed)

    proc.wait()
    packet = aggregator.finalize()
    if proc.returncode not in (0, None):
        packet.status = "failed"
        packet.errors.append(f"codex exit code: {proc.returncode}")

    write_packet_files(output_dir, packet, raw_lines)
    return packet


def build_default_codex_prompt(task: str) -> str:
    return "\n".join(
        [
            "You are a bounded worker. Stay tightly on task.",
            "Do not browse unrelated topics.",
            "Make visible progress using explicit artifacts only.",
            "Return a concise WORKER_CHECKPOINT at the end.",
            "",
            f"TASK: {task}",
        ]
    )


def build_kiro_validation_prompt(packet: CodexWorkerPacket) -> str:
    return "\n".join(
        [
            "Validate this Codex CLI worker packet.",
            "Classify it as ON_TOPIC, DRIFTING, or ROGUE.",
            "Assign a confidence_score from 0 to 100.",
            "Choose a recommended_action from accept, accept_with_cleanup, retry_narrower, replace_worker, or stop_for_human.",
            "Salvage only visible artifacts and explicit evidence.",
            "If needed, provide a compact RESTART_PACKET for a narrower replacement worker.",
            "",
            packet.to_markdown(),
            "",
            "Return a VALIDATION_REPORT with:",
            "verdict:",
            "confidence_score:",
            "recommended_action:",
            "why:",
            "keep:",
            "drop:",
            "restart_packet:",
        ]
    )


def ask_kiro_to_validate(
    *,
    cwd: Path,
    packet: CodexWorkerPacket,
    output_dir: Path,
    agent: str = "pipeline-validator",
    model: str | None = None,
) -> PromptTurn:
    client = KiroACPClient(cwd=cwd, agent=agent, model=model)
    stderr_lines: list[str] = []
    try:
        client.start()
        session_id = client.new_session()
        turn = client.prompt(session_id, build_kiro_validation_prompt(packet), timeout=240.0)
    except Exception:
        stderr_lines = client.stderr_lines
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / "kiro-stderr.txt").write_text("\n".join(stderr_lines) + "\n")
        raise
    finally:
        stderr_lines = client.stderr_lines
        client.close()

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "kiro-response.md").write_text(
        (turn.final_text or f"(no visible Kiro text, stopReason={turn.stop_reason})") + "\n"
    )
    (output_dir / "kiro-updates.json").write_text(
        json.dumps(
            {
                "stopReason": turn.stop_reason,
                "updates": turn.updates,
                "stderr": stderr_lines,
            },
            indent=2,
        )
        + "\n"
    )
    return turn


def write_bridge_summary(
    *,
    output_dir: Path,
    packet: CodexWorkerPacket,
    kiro_turn: PromptTurn | None,
    kiro_error: str | None = None,
) -> None:
    summary_lines = [
        f"Codex status: {packet.status}",
        f"Visible output captured: {'yes' if packet.visible_output else 'no'}",
        f"Tool activity items: {len(packet.tool_activity)}",
        f"Reasoning signals captured: {len(packet.reasoning_signals)}",
        f"Errors captured: {len(packet.errors)}",
    ]
    if kiro_turn:
        summary_lines.append(f"Kiro stopReason: {kiro_turn.stop_reason}")
        summary_lines.append(
            f"Kiro visible text captured: {'yes' if bool(kiro_turn.final_text) else 'no'}"
        )
    if kiro_error:
        summary_lines.append(f"Kiro error: {kiro_error}")
    (output_dir / "summary.txt").write_text("\n".join(summary_lines) + "\n")
