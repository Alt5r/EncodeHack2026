# Multi-Agent Supervision Demo

This workspace is a Kiro example project for supervised multi-agent execution.

Core rules:

- Prefer the `pipeline-orchestrator` subagent for complex tasks that benefit from delegation.
- Never assume access to a subagent's hidden reasoning. Treat only explicit outputs as valid artifacts.
- Every worker must emit a structured checkpoint.
- Every checkpoint must be validated before its contents are reused.
- If a worker drifts off-topic, salvage only validated artifacts, discard the rest, and spawn a replacement worker from a restart packet.
- "Kill" means logical rejection of that worker's output inside the pipeline. Do not rely on mid-flight interruption.

Accepted reusable artifacts:

- Verified facts
- File references
- Concrete partial code
- Test results
- Explicit decisions
- Clear next-step prompts

Rejected reusable artifacts:

- Unsupported claims
- Self-justification
- Private chain-of-thought
- Off-topic exploration
- Content not tied to the current objective
