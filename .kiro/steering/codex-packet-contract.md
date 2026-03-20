---
inclusion: always
---

# Codex Packet Contract

When Kiro supervises a Codex CLI worker in this workspace, the bridge script emits a `CODEX_WORKER_PACKET`.

Treat the following fields as valid supervision inputs:

- `status`
- `visible_output`
- `final_message`
- `tool_activity`
- `reasoning_signals`
- `errors`
- `non_json_output`

Do not assume:

- access to hidden chain-of-thought
- that a reasoning signal is a complete explanation
- that non-JSON transport logs are task evidence unless they clearly show a concrete failure

If a packet is partially useful:

- keep explicit artifacts
- drop unsupported interpretation
- rerun Codex with a narrower bounded task
