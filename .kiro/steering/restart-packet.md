---
inclusion: always
---

# Restart Packet Contract

When a worker is `DRIFTING` or `ROGUE`, the validator must produce a compact `RESTART_PACKET`.

## Required format

```text
RESTART_PACKET
original_goal:
accepted_context:
dropped_context:
remaining_gap:
constraints:
replacement_agent_brief:
```

## Field rules

- `original_goal`: the exact bounded packet objective
- `accepted_context`: only validated facts, artifacts, and evidence
- `dropped_context`: a short note about what was rejected and why
- `remaining_gap`: the smallest unresolved piece of work
- `constraints`: scope, safety, and format requirements for the replacement worker
- `replacement_agent_brief`: a concise prompt for the fresh worker

## Restart discipline

- The replacement worker should be able to succeed from the restart packet alone.
- The replacement brief should be narrower than the failed attempt.
- Do not quote or paste long rejected sections into the packet.
