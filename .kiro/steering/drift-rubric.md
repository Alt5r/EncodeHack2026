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

## Confidence scoring

Use an integer from `0` to `100`.

- `90-100`: verdict is obvious and strongly supported
- `70-89`: verdict is strong with minor ambiguity
- `40-69`: mixed packet, partial salvage, noticeable uncertainty
- `0-39`: severe drift, major ambiguity, or unusable evidence

## Recommended action

Choose exactly one:

- `accept`
- `accept_with_cleanup`
- `retry_narrower`
- `replace_worker`
- `stop_for_human`

Default mapping:

- `ON_TOPIC` -> `accept` or `accept_with_cleanup`
- `DRIFTING` -> `retry_narrower`
- `ROGUE` -> `replace_worker`
- environment or evidence failure -> `stop_for_human`
