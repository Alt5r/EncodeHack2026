#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from bridge.kiro_acp import KiroACPError
from bridge.supervisor import (
    ask_kiro_to_validate,
    build_default_codex_prompt,
    run_live_codex,
    run_mock_codex,
    write_bridge_summary,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a Codex CLI worker, extract structured packet data, and optionally send it to Kiro via ACP."
    )
    parser.add_argument(
        "--task",
        default="Inspect this repository and report only relevant findings.",
        help="Bounded task to give the Codex worker.",
    )
    parser.add_argument(
        "--codex-mode",
        choices=("mock", "live"),
        default="mock",
        help="Use a fixture stream or call the real Codex CLI.",
    )
    parser.add_argument(
        "--mock-stream",
        default="fixtures/mock_codex_on_topic.jsonl",
        help="Fixture file to replay when --codex-mode mock.",
    )
    parser.add_argument(
        "--kiro-mode",
        choices=("off", "live"),
        default="off",
        help="Whether to send the extracted packet to Kiro over ACP.",
    )
    parser.add_argument(
        "--kiro-agent",
        default="pipeline-validator",
        help="Kiro agent to use when --kiro-mode live.",
    )
    parser.add_argument(
        "--kiro-model",
        default=None,
        help="Optional Kiro model override.",
    )
    parser.add_argument(
        "--codex-model",
        default="gpt-5.4-mini",
        help="Model to use in live Codex mode.",
    )
    parser.add_argument(
        "--codex-sandbox",
        default="read-only",
        choices=("read-only", "workspace-write", "danger-full-access"),
        help="Sandbox mode for the live Codex worker.",
    )
    parser.add_argument(
        "--output-dir",
        default="runtime/codex-kiro-bridge",
        help="Directory where packet files and Kiro output are written.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = REPO_ROOT
    output_dir = repo_root / args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    codex_prompt = build_default_codex_prompt(args.task)
    if args.codex_mode == "mock":
        packet = run_mock_codex(args.task, repo_root / args.mock_stream, output_dir)
    else:
        packet = run_live_codex(
            task=args.task,
            prompt=codex_prompt,
            cwd=repo_root,
            output_dir=output_dir,
            model=args.codex_model,
            sandbox=args.codex_sandbox,
        )

    kiro_turn = None
    kiro_error = None
    if args.kiro_mode == "live":
        try:
            kiro_turn = ask_kiro_to_validate(
                cwd=repo_root,
                packet=packet,
                output_dir=output_dir,
                agent=args.kiro_agent,
                model=args.kiro_model,
            )
        except KiroACPError as exc:
            kiro_error = str(exc)
            (output_dir / "kiro-error.txt").write_text(kiro_error + "\n")

    write_bridge_summary(
        output_dir=output_dir,
        packet=packet,
        kiro_turn=kiro_turn,
        kiro_error=kiro_error,
    )

    print(f"Wrote bridge artifacts to {output_dir}")
    print(f"Codex packet status: {packet.status}")
    if kiro_turn:
        print(f"Kiro stopReason: {kiro_turn.stop_reason}")
    elif kiro_error:
        print(f"Kiro validation failed: {kiro_error}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
