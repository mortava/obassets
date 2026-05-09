# Workflow templates

Reusable building blocks. These are not full workflows; they are
fragments referenced from real workflows or pasted in by a workflow
author when starting from scratch.

| File | Purpose |
|---|---|
| `auth-and-load.yaml` | Standard opening steps: pull loan, hydrate field map, log run start |
| `human-approval-gate.yaml` | Human-in-the-loop gate with AI summary + proposed action + SLA |
| `redact-then-ai.yaml` | Apply tenant redaction policy before any external AI call |
| `notify-broker.yaml` | Standard broker notification with template + log to loan |

Templates use `${var}` placeholders that the author replaces inline.
