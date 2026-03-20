---
name: kiro-validation-report
description: Use when validating a WORKER_CHECKPOINT or CODEX_WORKER_PACKET for drift, rogue behavior, salvageability, confidence scoring, and next-action recommendations.
---

# Kiro Validation Report

Use this skill when reviewing any worker artifact that needs a structured validation decision.

Supported inputs:

- `WORKER_CHECKPOINT`
- `CODEX_WORKER_PACKET`

## Required Output

Return exactly one structured report:

```text
VALIDATION_REPORT
verdict:
confidence_score:
recommended_action:
why:
keep:
drop:
restart_packet:
```

## Verdicts

- `ON_TOPIC`: aligned, evidence-backed, and reusable
- `DRIFTING`: partially useful, but scope wandered
- `ROGUE`: unrelated, unsupported, or unusable without major rework

## Confidence Score

Use an integer from `0` to `100`.

- `90-100`: verdict is obvious and strongly supported by the packet
- `70-89`: verdict is strong, with only minor ambiguity
- `40-69`: mixed evidence; salvage is possible but uncertainty remains
- `0-39`: severe drift, missing evidence, or contradictory signals

Lower confidence when:

- evidence is thin
- tool activity is incomplete
- visible output conflicts with the verdict
- the packet mixes valid and invalid work

Raise confidence when:

- the tool trail clearly matches or clearly violates the task
- the visible output and errors point to the same conclusion
- salvageable artifacts are easy to separate from dropped material

## Recommended Action

Choose one:

- `accept`: keep the result and proceed
- `accept_with_cleanup`: keep the result after pruning obvious noise
- `retry_narrower`: rerun the same worker type with tighter scope
- `replace_worker`: discard most or all of the result and spawn a fresh worker
- `stop_for_human`: environment, safety, or ambiguity requires human review

Use this default mapping:

- `ON_TOPIC` + high confidence -> `accept`
- `ON_TOPIC` + moderate confidence -> `accept_with_cleanup`
- `DRIFTING` + salvageable artifacts -> `retry_narrower`
- `ROGUE` + clean failure pattern -> `replace_worker`
- contradictory evidence or broken environment -> `stop_for_human`

## Salvage Rules

Keep only:

- explicit evidence
- concrete partial deliverables
- valid file references
- useful constraints for the replacement worker

Drop:

- unsupported interpretation
- off-topic output
- reasoning signals that do not directly help the next worker
- meta commentary about the worker itself

## Restart Packet Rule

If the recommended action is `retry_narrower` or `replace_worker`, produce a compact `RESTART_PACKET`.

If the recommended action is `accept` or `accept_with_cleanup`, `restart_packet` should be `none`.
