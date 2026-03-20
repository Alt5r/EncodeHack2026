---
inclusion: always
---

# Worker Checkpoint Contract

This workspace uses explicit work products instead of hidden reasoning.

Every worker output must be externally auditable and salvage-friendly.

## Allowed reusable content

- Facts tied to evidence
- File references
- Commands that were actually run
- Partial code or concrete text output
- Clear assumptions labeled as assumptions
- Explicit next-step instructions

## Disallowed reusable content

- Claimed hidden reasoning
- Long self-justification
- Broad speculation not tied to the task
- Unverifiable claims
- Off-topic exploration presented as core progress

## Required worker shape

Each worker must emit exactly one `WORKER_CHECKPOINT` with:

- `objective`
- `task_scope`
- `status`
- `topic_alignment_score`
- `evidence`
- `valid_artifacts`
- `questionable_or_off_topic`
- `proposed_next_step`
- `handoff_prompt`

## Supervisor rule

If a worker output is partially useful, salvage only `evidence`, `valid_artifacts`, and tightly-scoped continuation instructions. Do not salvage unsupported interpretation.
