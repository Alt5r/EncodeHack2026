---
inclusion: always
---

# Drift And Rogue Rubric

Use this rubric whenever validating a worker checkpoint.

## ON_TOPIC

Choose `ON_TOPIC` when:

- The worker stayed within the assigned packet.
- Most evidence directly supports the objective.
- The artifacts are reusable with little or no cleanup.
- Any side exploration is minor and clearly separated.

## DRIFTING

Choose `DRIFTING` when:

- The worker started correctly but expanded into adjacent areas.
- Some artifacts are useful, but the answer contains avoidable detours.
- The worker answered a broader question than assigned.
- The checkpoint is recoverable with a restart packet.

## ROGUE

Choose `ROGUE` when:

- The output is mostly unrelated to the objective.
- The worker invented context or relied on unsupported assumptions.
- The worker spent most of its effort on unrelated exploration.
- The artifacts cannot be trusted without major rework.

## Salvage policy

Keep:

- Verifiable facts
- Concrete partial deliverables
- Useful file references
- Valid constraints
- Clean follow-up prompts

Drop:

- Unsupported inference
- Meta commentary about reasoning quality
- Large off-topic sections
- Any content that would bias the replacement worker away from the true objective
