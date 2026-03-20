# Kiro Multi-Agent Supervision Demo

This repository is a minimal Kiro-native example of a supervised multi-agent pipeline for a hackathon demo.

The goal is to show a supervisor that:

- delegates bounded tasks to worker subagents
- checks whether a worker drifted off-topic
- rejects the bad portion of the output
- salvages only validated artifacts
- spawns a replacement worker from a clean restart packet

## What This Demo Uses

- Workspace subagents in `.kiro/agents/`
- Workspace steering in `.kiro/steering/`
- A supervisor pattern based on explicit worker checkpoints

## Important Limitation

This demo does **not** rely on reading a model's hidden reasoning.

Instead, it treats only explicit outputs as reusable:

- evidence
- partial code
- validated facts
- clean handoff prompts

Also, Kiro subagents run in parallel and the main agent waits for them to finish, so this demo models "kill the rogue agent" as a logical rejection-and-replace step after validation, not guaranteed mid-flight interruption.

## Files

- `AGENTS.md`: workspace-wide rules for the demo
- `.kiro/agents/pipeline-orchestrator.md`: supervisor agent
- `.kiro/agents/pipeline-worker.md`: bounded execution worker
- `.kiro/agents/pipeline-validator.md`: drift and rogue detector
- `.kiro/agents/pipeline-rescue.md`: recovery worker
- `.kiro/steering/multi-agent-contract.md`: worker output schema
- `.kiro/steering/drift-rubric.md`: validator rubric
- `.kiro/steering/restart-packet.md`: replacement worker handoff format

## How To Use In Kiro

1. Open this folder in Kiro.
2. Let Kiro index the workspace so the subagents and steering files are visible.
3. Switch to Supervised mode first if you want tighter control while learning the flow.
4. Start the orchestrator explicitly with a prompt like:

```text
/pipeline-orchestrator
Build a demo multi-agent workflow for triaging hackathon project ideas.
Split the work into 3 bounded packets.
Run worker subagents in parallel.
Validate each worker output with the pipeline-validator.
If a worker is DRIFTING or ROGUE, discard the bad portion, build a RESTART_PACKET,
and spawn a pipeline-rescue worker to continue from the approved artifacts only.
Return the accepted artifacts and the final synthesized result.
```

## Good Demo Tasks

Use tasks where drift is easy to recognize:

- classify incoming project ideas into product, technical, and demo-risk buckets
- analyze a small codebase in parallel by feature area
- generate a launch checklist from several independent sources
- research competitors, validate facts, and merge only supported findings

## How To Explain The Architecture In A Hackathon

Use this framing:

- The worker does the task.
- The validator judges alignment and extractable value.
- The supervisor decides whether to accept, discard, or respawn.
- The rescue worker continues from approved artifacts only.

That gives you a simple "supervise, quarantine, salvage, replace" story without pretending you can safely mine hidden chain-of-thought.

## Codex Bridge Demo

This repo now also includes a small test project that bridges `codex exec --json` into a Kiro ACP session.

The bridge does three things:

- runs a Codex worker through the local `codex` CLI
- extracts visible text, tool activity, reasoning signals, and errors from the JSONL stream
- optionally sends the resulting `CODEX_WORKER_PACKET` to Kiro for validation, confidence scoring, and action selection

### Files

- `bridge/codex_events.py`: parses Codex JSONL into a structured packet
- `bridge/kiro_acp.py`: minimal stdlib ACP client for Kiro
- `bridge/supervisor.py`: mock/live Codex runner plus Kiro validation helper
- `scripts/run_codex_kiro_bridge.py`: main demo entrypoint
- `fixtures/mock_codex_on_topic.jsonl`: replayable success fixture
- `fixtures/mock_codex_rogue.jsonl`: replayable drift fixture
- `tests/`: parser and packet rendering tests

### Quick Mock Demo

This does not require live Codex or live Kiro responses:

```bash
python3 scripts/run_codex_kiro_bridge.py \
  --codex-mode mock \
  --mock-stream fixtures/mock_codex_on_topic.jsonl \
  --output-dir runtime/mock-on-topic
```

Try the rogue fixture too:

```bash
python3 scripts/run_codex_kiro_bridge.py \
  --codex-mode mock \
  --mock-stream fixtures/mock_codex_rogue.jsonl \
  --output-dir runtime/mock-rogue
```

The runner writes:

- `codex-events.jsonl`
- `codex-worker-packet.json`
- `codex-worker-packet.md`
- `summary.txt`

### Live Codex + Kiro Demo

This path requires:

- `codex` authenticated and able to reach the network
- `kiro-cli` authenticated with `kiro-cli login`

Run:

```bash
python3 scripts/run_codex_kiro_bridge.py \
  --codex-mode live \
  --kiro-mode live \
  --task "Inspect this repository and report only relevant findings." \
  --kiro-agent pipeline-validator \
  --output-dir runtime/live-bridge
```

What happens:

1. The script runs `codex exec --json`.
2. It converts the stream into a `CODEX_WORKER_PACKET`.
3. It starts `kiro-cli acp`.
4. It sends the packet to Kiro as a validation prompt that requests `verdict`, `confidence_score`, and `recommended_action`.
5. It writes Kiro's response to `kiro-response.md`.

### Kiro Calls Codex Directly

If you want Kiro itself to trigger the local Codex worker instead of using the ACP loop, use the workspace agent:

```text
/codex-cli-bridge
Run a Codex worker to inspect this repository for off-topic drift risks.
Use a bounded task and write the output to runtime/kiro-codex-shell.
Then read codex-worker-packet.md and decide whether to continue, reject, or rerun narrower.
```

That workflow is simpler:

1. Kiro runs the bridge script through its shell tool.
2. Codex executes through `codex exec --json`.
3. The bridge writes `CODEX_WORKER_PACKET` files.
4. Kiro reads those files and decides what to do next.

Use this path when you want Kiro to be the visible operator and do not need ACP-based feedback into a separate Kiro session.

### What Is Actually Extracted

The bridge treats these as valid extraction surfaces:

- visible text deltas
- final visible message
- tool call and tool output metadata
- reasoning-related signals if they appear in the stream
- errors and transport failures

It does **not** assume access to private chain-of-thought.

### Validation Skill

The report scoring logic now also exists as a reusable skill file:

- `.agents/skills/kiro-validation-report/SKILL.md`

That skill defines:

- the `VALIDATION_REPORT` schema
- how to assign `confidence_score`
- how to choose `recommended_action`
- when to emit a `RESTART_PACKET`

### Running Tests

```bash
python3 -m unittest discover -s tests
```

### Notes

- In this sandboxed environment, live Codex network calls are blocked, so only the mock path and Kiro ACP initialization were verified here.
- The live bridge code is still useful on your machine once `codex` and `kiro-cli` have network access and valid login state.
